/*
 *
 * @group xyk
 * @group asset
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calculate_buy_price_local,
  calculate_buy_price_rpc,
  getBalanceOfPool,
  buyAsset,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { calculateFees, getEnvironmentRequiredVars } from "../../utils/utils";
import { testLog } from "../../utils/Logger";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  EVENT_SECTION_PAYMENT,
  EVENT_METHOD_PAYMENT,
} from "../../utils/Constants";

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
const { xykPalletAddress: pallet_address, sudo: sudoUserName } =
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
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  const sudo = new User(keyring, sudoUserName);

  // setup Pallet.
  pallet = new User(keyring);
  pallet.addFromAddress(keyring, pallet_address);
  await testUser1.addMGATokens(sudo);
  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );

  await testUser1.createPoolToAsset(
    new BN(50000),
    new BN(50000),
    firstCurrency,
    secondCurrency,
  );

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(pallet.keyRingPair);

  // check users accounts.

  pallet.addAssets([firstCurrency, secondCurrency]);
  testUser2.addAssets([firstCurrency, secondCurrency]);
  await pallet.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], buy asset", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );

  const amount = new BN(10000);
  // considering the pool and the 10k amount
  const buyPriceLocal = calculate_buy_price_local(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount,
  );
  const buyPriceRpc = await calculate_buy_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount,
  );
  expect(buyPriceLocal).bnEqual(buyPriceRpc);

  testLog
    .getLog()
    .info(
      "Bob: buying asset " +
        secondCurrency +
        ", selling asset " +
        firstCurrency,
    );
  const soldAssetId = firstCurrency;
  const boughtAssetId = secondCurrency;

  await buyAsset(
    testUser1.keyRingPair,
    soldAssetId,
    boughtAssetId,
    amount,
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "AssetsSwapped",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    expect(
      result.findIndex(
        (x) =>
          x.section === EVENT_SECTION_PAYMENT ||
          x.method === EVENT_METHOD_PAYMENT,
      ),
    ).toEqual(-1);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let addFromWallet = testUser1
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.add(amount);
  expect(testUser1.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  let diffFromWallet = testUser1
    .getAsset(soldAssetId)
    ?.amountBefore.free!.sub(buyPriceLocal);
  expect(testUser1.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  testUser2.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });
  const { treasury, treasuryBurn } = calculateFees(buyPriceLocal);
  const bothFees = treasury.add(treasuryBurn);
  addFromWallet = pallet
    .getAsset(soldAssetId)
    ?.amountBefore.free!.add(buyPriceLocal)
    .sub(bothFees);
  expect(pallet.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  diffFromWallet = pallet
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.sub(amount);
  expect(pallet.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);

  expect([
    poolBalanceBefore[0].add(buyPriceLocal).sub(bothFees),
    poolBalanceBefore[1].sub(amount),
  ]).collectionBnEqual(pool_balance);
});

test("xyk-pallet - AssetsOperation: buyAsset [maxAmountIn = 1M], sell a bought asset", async () => {
  let amount = new BN(10000);

  testLog
    .getLog()
    .info(
      "buying asset " + secondCurrency + ", selling asset " + firstCurrency,
    );
  let soldAssetId = firstCurrency;
  let boughtAssetId = secondCurrency;
  await testUser1.buyAssets(soldAssetId, boughtAssetId, amount);

  amount = new BN(15000);
  // considering the pool and the 15k amount
  const poolBalanceBefore = await getBalanceOfPool(
    secondCurrency,
    firstCurrency,
  );
  const buyPriceLocal = calculate_buy_price_local(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount,
  );
  const buypriceRpc = await calculate_buy_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount,
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

  let addFromWallet = testUser1
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.add(amount);
  expect(testUser1.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  let diffFromWallet = testUser1
    .getAsset(soldAssetId)
    ?.amountBefore.free!.sub(buyPriceLocal);
  expect(testUser1.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  testUser2.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });
  const { treasury, treasuryBurn } = calculateFees(buyPriceLocal);
  const bothFees = treasury.add(treasuryBurn);

  addFromWallet = pallet
    .getAsset(soldAssetId)
    ?.amountBefore.free!.add(buyPriceLocal)
    .sub(bothFees);
  expect(pallet.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  diffFromWallet = pallet
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.sub(amount);
  expect(pallet.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(secondCurrency, firstCurrency);
  expect([
    poolBalanceBefore[0].add(buyPriceLocal).sub(bothFees),
    poolBalanceBefore[1].sub(amount),
  ]).collectionBnEqual(pool_balance);
});
