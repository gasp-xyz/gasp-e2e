/*
 *
 * @group xyk
 * @group pool
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  getLiquidityAssetId,
  getAssetSupply,
  createPool,
  getLiquidityPool,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import BN from "bn.js";
import { AssetWallet, User } from "../../utils/User";
import {
  calculateLiqAssetAmount,
  getEnvironmentRequiredVars,
} from "../../utils/utils";
import { testLog } from "../../utils/Logger";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import {
  validateAssetsWithValues,
  validateEmptyAssets,
} from "../../utils/validators";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let pallet: User;

let firstCurrency: BN;
let secondCurrency: BN;
let keyring: Keyring;

// Assuming the pallet's AccountId
const { xykPalletAddress: pallet_address, sudo: sudoUserName } =
  getEnvironmentRequiredVars();
const defaultCurrecyValue = new BN(250000);

// Assuming the pallet's AccountId

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
    sudo
  );
  await testUser1.addMGATokens(sudo);

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

  validateAssetsWithValues(
    [
      testUser1.getAsset(firstCurrency)?.amountBefore!,
      testUser1.getAsset(secondCurrency)?.amountBefore!,
    ],
    [
      defaultCurrecyValue.toNumber(),
      defaultCurrecyValue.add(new BN(1)).toNumber(),
    ]
  );
  validateEmptyAssets([
    testUser2.getAsset(firstCurrency)?.amountBefore!,
    testUser2.getAsset(secondCurrency)?.amountBefore!,
  ]);
});

test("xyk-pallet - Pool tests: createPool and validate liq token", async () => {
  const pool_balance_before = [new BN(0), new BN(0)];
  const total_liquidity_assets_before = new BN(0);

  const firstAssetAmount = new BN(50000);
  const secondAssetAmount = new BN(50000);

  testLog
    .getLog()
    .info("testUser1: creating pool " + firstCurrency + " - " + secondCurrency);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    firstAssetAmount,
    secondCurrency,
    secondAssetAmount
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "PoolCreated",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const liquidity_asset_id = await getLiquidityAssetId(
    firstCurrency,
    secondCurrency
  );
  const liquidity_assets_minted = calculateLiqAssetAmount(
    firstAssetAmount,
    secondAssetAmount
  );

  testUser1.addAsset(liquidity_asset_id, new BN(0));
  testUser2.addAsset(liquidity_asset_id, new BN(0));
  //validate

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let diffFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore!.sub(firstAssetAmount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter!).bnEqual(
    diffFromWallet!
  );

  diffFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore!.sub(secondAssetAmount);
  expect(testUser1.getAsset(secondCurrency)?.amountAfter!).bnEqual(
    diffFromWallet!
  );

  let addFromWallet = testUser1
    .getAsset(liquidity_asset_id)
    ?.amountBefore!.add(liquidity_assets_minted);
  expect(testUser1.getAsset(liquidity_asset_id)?.amountAfter!).bnEqual(
    addFromWallet!
  );

  testUser2.assets.forEach((asset) => {
    expect(asset.amountBefore).bnEqual(asset.amountAfter);
  });

  addFromWallet = pallet
    .getAsset(firstCurrency)
    ?.amountBefore!.add(firstAssetAmount);
  expect(pallet.getAsset(firstCurrency)?.amountAfter!).bnEqual(addFromWallet!);

  addFromWallet = pallet
    .getAsset(secondCurrency)
    ?.amountBefore!.add(secondAssetAmount);
  expect(pallet.getAsset(secondCurrency)?.amountAfter!).bnEqual(addFromWallet!);
  //TODO: pending to validate.
  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    pool_balance_before[0].add(firstAssetAmount),
    pool_balance_before[1].add(secondAssetAmount),
  ]).toEqual(pool_balance);

  const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets
  );

  //Validate liquidity pool.
  const liquidityPool = await getLiquidityPool(liquidity_asset_id);
  expect(liquidityPool[0]).bnEqual(firstCurrency);
  expect(liquidityPool[1]).bnEqual(secondCurrency);
});

test("xyk-pallet - Pool tests: createPool", async () => {
  const pool_balance_before = [new BN(0), new BN(0)];
  const total_liquidity_assets_before = new BN(0);

  const firstAssetAmount = new BN(50000);
  const secondAssetAmount = new BN(50000);

  testLog
    .getLog()
    .info("testUser1: creating pool " + firstCurrency + " - " + secondCurrency);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    firstAssetAmount,
    secondCurrency,
    secondAssetAmount
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "PoolCreated",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const liquidity_asset_id = await getLiquidityAssetId(
    firstCurrency,
    secondCurrency
  );
  const liquidity_assets_minted = calculateLiqAssetAmount(
    firstAssetAmount,
    secondAssetAmount
  );

  testUser1.addAsset(liquidity_asset_id, new BN(0));
  testUser2.addAsset(liquidity_asset_id, new BN(0));
  //validate

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let diffFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore!.sub(firstAssetAmount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter!).bnEqual(
    diffFromWallet!
  );

  diffFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore!.sub(secondAssetAmount);
  expect(testUser1.getAsset(secondCurrency)?.amountAfter!).bnEqual(
    diffFromWallet!
  );

  let addFromWallet = testUser1
    .getAsset(liquidity_asset_id)
    ?.amountBefore!.add(liquidity_assets_minted);
  expect(testUser1.getAsset(liquidity_asset_id)?.amountAfter!).bnEqual(
    addFromWallet!
  );

  testUser2.assets.forEach((asset) => {
    expect(asset.amountBefore).bnEqual(asset.amountAfter);
  });

  addFromWallet = pallet
    .getAsset(firstCurrency)
    ?.amountBefore!.add(firstAssetAmount);
  expect(pallet.getAsset(firstCurrency)?.amountAfter!).bnEqual(addFromWallet!);

  addFromWallet = pallet
    .getAsset(secondCurrency)
    ?.amountBefore!.add(secondAssetAmount);
  expect(pallet.getAsset(secondCurrency)?.amountAfter!).bnEqual(addFromWallet!);
  //TODO: pending to validate.
  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    pool_balance_before[0].add(firstAssetAmount),
    pool_balance_before[1].add(secondAssetAmount),
  ]).toEqual(pool_balance);

  const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets
  );

  //Validate liquidity pool.
  const liquidityPool = await getLiquidityPool(liquidity_asset_id);
  expect(liquidityPool[0]).bnEqual(firstCurrency);
  expect(liquidityPool[1]).bnEqual(secondCurrency);
});
