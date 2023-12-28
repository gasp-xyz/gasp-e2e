/*
 *
 * @group xyk
 * @group asset
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calculate_sell_price_local,
  calculate_sell_price_rpc,
  getBalanceOfPool,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { calculateFees, getEnvironmentRequiredVars } from "../../utils/utils";
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

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );
  await testUser1.addMGATokens(sudo);
  await testUser1.createPoolToAsset(
    new BN(60000),
    new BN(60000),
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

test("xyk-pallet - AssetsOperation: sellAsset [minAmountOut = 0] , first to second currency", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );
  const amount = new BN(30000);

  const sellPriceLocal = calculate_sell_price_local(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount,
  );
  const sellPriceRpc = await calculate_sell_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    amount,
  );
  expect(sellPriceLocal).bnEqual(sellPriceRpc);
  testLog
    .getLog()
    .info(
      "selling asset " + firstCurrency + ", buying asset " + secondCurrency,
    );

  const soldAssetId = firstCurrency;
  const boughtAssetId = secondCurrency;

  await testUser1.sellAssets(soldAssetId, secondCurrency, amount);

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let diffFromWallet = testUser1
    .getAsset(soldAssetId)
    ?.amountBefore.free!.sub(amount);
  expect(testUser1.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  let addFromWallet = testUser1
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.add(sellPriceLocal);
  expect(testUser1.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  testUser2.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });

  diffFromWallet = pallet
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.sub(sellPriceLocal);
  expect(pallet.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  addFromWallet = pallet.getAsset(soldAssetId)?.amountBefore.free!.add(amount);

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  //we sell 30k:
  //In the pool we will find: AmountBefore + (30k - 0.05% -0.05%) => 30k - 0.1% => 30k - 30Tkns
  //Other two are about rounding.
  const fee = new BN(30).add(new BN(2));
  expect([
    poolBalanceBefore[0].add(amount).sub(fee),
    poolBalanceBefore[1].sub(sellPriceLocal),
  ]).collectionBnEqual(pool_balance);
  expect(pallet.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!.sub(fee),
  );
});

test("xyk-pallet - AssetsOperation: sellAsset [minAmountOut = 0], sell an already sold asset", async () => {
  let amount = new BN(30000);
  let soldAssetId = firstCurrency;
  let boughtAssetId = secondCurrency;
  await testUser1.sellAssets(soldAssetId, boughtAssetId, amount);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await pallet.refreshAmounts(AssetWallet.BEFORE);
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );

  amount = new BN(20000);
  // considering the previous bought and the 20k amount
  const sellPriceLocal = calculate_sell_price_local(
    poolBalanceBefore[1],
    poolBalanceBefore[0],
    amount,
  );
  const sellPriceRpc = await calculate_sell_price_rpc(
    poolBalanceBefore[1],
    poolBalanceBefore[0],
    amount,
  );
  expect(sellPriceLocal).bnEqual(sellPriceRpc);

  soldAssetId = secondCurrency;
  boughtAssetId = firstCurrency;
  await testUser1.sellAssets(soldAssetId, boughtAssetId, amount);

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let diffFromWallet = testUser1
    .getAsset(soldAssetId)
    ?.amountBefore.free!.sub(amount);
  expect(testUser1.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  let addFromWallet = testUser1
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.add(sellPriceLocal);
  expect(testUser1.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  testUser2.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });

  diffFromWallet = pallet
    .getAsset(boughtAssetId)
    ?.amountBefore.free!.sub(sellPriceLocal);

  const { treasury, treasuryBurn } = calculateFees(amount);
  const bothFees = treasury.add(treasuryBurn);
  expect(pallet.getAsset(boughtAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  addFromWallet = pallet
    .getAsset(soldAssetId)
    ?.amountBefore.free!.add(amount)
    .sub(bothFees);
  expect(pallet.getAsset(soldAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    poolBalanceBefore[0].sub(sellPriceLocal),
    poolBalanceBefore[1].add(amount).sub(bothFees),
  ]).collectionBnEqual(pool_balance);
});
