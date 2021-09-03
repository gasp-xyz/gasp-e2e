/*
 *
 * @group xyk
 * @group asset
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import {
  calculate_buy_price_local,
  calculate_buy_price_rpc,
  getBalanceOfPool,
  buyAsset,
} from "../../utils/tx";
import { waitNewBlock, ExtrinsicResult } from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromTxWait } from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let pallet: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;

// Assuming the pallet's AccountId
const { pallet: pallet_address, sudo: sudoUserName } =
  getEnvironmentRequiredVars();
const defaultCurrecyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

beforeEach(async () => {
  await waitNewBlock();
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  const sudo = new User(keyring, sudoUserName);

  // setup Pallet.
  pallet = new User(keyring);
  pallet.addFromAddress(keyring, pallet_address);

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo
  );
  await testUser1.addMGATokens(sudo);
  await waitNewBlock();
  await testUser1.createPoolToAsset(
    new BN(50000),
    new BN(50000),
    firstCurrency,
    secondCurrency
  );

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(pallet.keyRingPair);

  // check users accounts.
  await waitNewBlock();
  pallet.addAssets([firstCurrency, secondCurrency]);
  testUser2.addAssets([firstCurrency, secondCurrency]);
  await pallet.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], buy asset", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency
  );

  const amount = new BN(10000);
  // considering the pool and the 10k amount
  const traseureAndBurn = new BN(3).mul(new BN(2));
  const buyPriceLocal = calculate_buy_price_local(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount
  );
  const buyPriceRpc = await calculate_buy_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount
  );
  expect(buyPriceLocal).toEqual(buyPriceRpc);

  testLog
    .getLog()
    .info(
      "Bob: buying asset " + secondCurrency + ", selling asset " + firstCurrency
    );
  const soldAssetId = firstCurrency;
  const boughtAssetId = secondCurrency;

  await buyAsset(
    testUser1.keyRingPair,
    soldAssetId,
    boughtAssetId,
    amount,
    new BN(1000000)
  ).then((result) => {
    const eventResponse = getEventResultFromTxWait(result, [
      "xyk",
      "AssetsSwapped",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  testUser1.validateWalletIncreased(boughtAssetId, amount);
  testUser1.validateWalletReduced(soldAssetId, buyPriceLocal);
  testUser2.validateWalletsUnmodified();
  pallet.validateWalletIncreased(soldAssetId, buyPriceLocal);
  pallet.validateWalletReduced(boughtAssetId, amount);
  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);

  expect([
    poolBalanceBefore[0].add(buyPriceLocal),
    poolBalanceBefore[1].sub(amount).sub(traseureAndBurn),
  ]).toEqual(pool_balance);
});

test("xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], sell a bought asset", async () => {
  let amount = new BN(10000);

  testLog
    .getLog()
    .info(
      "buying asset " + secondCurrency + ", selling asset " + firstCurrency
    );
  let soldAssetId = firstCurrency;
  let boughtAssetId = secondCurrency;
  await testUser1.buyAssets(soldAssetId, boughtAssetId, amount);

  amount = new BN(15000);
  // considering the pool and the 15k amount
  const traseureAndBurn = new BN(5).mul(new BN(2));
  const poolBalanceBefore = await getBalanceOfPool(
    secondCurrency,
    firstCurrency
  );
  const buyPriceLocal = calculate_buy_price_local(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount
  );
  const buypriceRpc = await calculate_buy_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount
  );
  expect(buyPriceLocal).bnEqual(buypriceRpc);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await pallet.refreshAmounts(AssetWallet.BEFORE);

  soldAssetId = secondCurrency;
  boughtAssetId = firstCurrency;

  await testUser1.buyAssets(soldAssetId, boughtAssetId, amount);

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  testUser1.validateWalletIncreased(boughtAssetId, amount);
  testUser1.validateWalletReduced(soldAssetId, buyPriceLocal);
  testUser2.validateWalletsUnmodified();
  pallet.validateWalletIncreased(soldAssetId, buyPriceLocal);
  pallet.validateWalletReduced(boughtAssetId, amount);
  const pool_balance = await getBalanceOfPool(secondCurrency, firstCurrency);
  expect([
    poolBalanceBefore[0].add(buyPriceLocal),
    poolBalanceBefore[1].sub(amount).sub(traseureAndBurn),
  ]).toEqual(pool_balance);
});
