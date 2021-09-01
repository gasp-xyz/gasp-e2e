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
import { calculateLiqAssetAmount } from "../../utils/utils";
import { getEventResultFromTxWait } from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let pallet: User;

let firstCurrency: BN;
let secondCurrency: BN;

// Assuming the pallet's AccountId

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

test("xyk-pallet - Pool tests: createPool and validate liq token", async () => {
  const pool_balance_before = [new BN(0), new BN(0)];
  const total_liquidity_assets_before = new BN(0);

  const first_asset_amount = new BN(50000);
  const second_asset_amount = new BN(50000);

  testLog
    .getLog()
    .info("testUser1: creating pool " + firstCurrency + " - " + secondCurrency);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    first_asset_amount,
    secondCurrency,
    second_asset_amount
  ).then((result) => {
    const eventResponse = getEventResultFromTxWait(result, [
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
    first_asset_amount,
    second_asset_amount
  );

  testUser1.addAsset(liquidity_asset_id, new BN(0));
  testUser2.addAsset(liquidity_asset_id, new BN(0));
  //validate

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  await testUser1.validateWalletReduced(firstCurrency, first_asset_amount);
  await testUser1.validateWalletReduced(secondCurrency, second_asset_amount);
  await testUser1.validateWalletIncreased(
    liquidity_asset_id,
    liquidity_assets_minted
  );

  await testUser2.validateWalletsUnmodified();

  await pallet.validateWalletIncreased(firstCurrency, first_asset_amount);
  await pallet.validateWalletIncreased(secondCurrency, second_asset_amount);

  //TODO: pending to validate.
  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
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

  const first_asset_amount = new BN(50000);
  const second_asset_amount = new BN(50000);

  testLog
    .getLog()
    .info("testUser1: creating pool " + firstCurrency + " - " + secondCurrency);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    first_asset_amount,
    secondCurrency,
    second_asset_amount
  ).then((result) => {
    const eventResponse = getEventResultFromTxWait(result, [
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
  const liquidity_assets_minted = first_asset_amount.add(second_asset_amount);

  testUser1.addAsset(liquidity_asset_id, new BN(0));
  testUser2.addAsset(liquidity_asset_id, new BN(0));
  //validate

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  await testUser1.validateWalletReduced(firstCurrency, first_asset_amount);
  await testUser1.validateWalletReduced(secondCurrency, second_asset_amount);
  await testUser1.validateWalletIncreased(
    liquidity_asset_id,
    liquidity_assets_minted
  );

  await testUser2.validateWalletsUnmodified();

  await pallet.validateWalletIncreased(firstCurrency, first_asset_amount);
  await pallet.validateWalletIncreased(secondCurrency, second_asset_amount);

  //TODO: pending to validate.
  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
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
