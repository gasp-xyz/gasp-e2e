/*
 *
 * @group xyk
 * @group market
 * @group liquidity
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calcuate_mint_liquidity_price_local,
  calcuate_burn_liquidity_price_local,
  getBalanceOfPool,
  getLiquidityAssetId,
  getAssetSupply,
  mintLiquidity,
  burnLiquidity,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { testLog } from "../../utils/Logger";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Sudo } from "../../utils/sudo";
import { getSudoUser } from "../../utils/setup";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let pallet: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
let liquidityAssetId: BN;

const { xykPalletAddress: pallet_address } = getEnvironmentRequiredVars();
const defaultCurrecyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

beforeEach(async () => {
  keyring = new Keyring({ type: "ethereum" });

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  const sudo = getSudoUser();

  // setup Pallet.
  pallet = new User(keyring);
  pallet.addFromAddress(keyring, pallet_address);

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        firstCurrency,
        new BN(40000),
        secondCurrency,
        new BN(30000),
      ),
    ),
  );

  liquidityAssetId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  testUser1.addAsset(liquidityAssetId);
  testUser2.addAsset(liquidityAssetId);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(pallet.keyRingPair);

  // check users accounts.

  pallet.addAssets([firstCurrency, secondCurrency]);
  testUser2.addAssets([firstCurrency, secondCurrency]);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await pallet.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-pallet - Liqudity : Burn part of the liquidity", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );
  const totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
  const liquidityAssetsBurned = new BN(20000);
  const [firstAssetAmount, second_asset_amount] =
    await calcuate_burn_liquidity_price_local(
      firstCurrency,
      secondCurrency,
      liquidityAssetsBurned,
    );

  testLog
    .getLog()
    .info(
      "burning liquidity " +
        liquidityAssetsBurned +
        "of pool " +
        firstCurrency +
        " - " +
        secondCurrency,
    );

  await burnLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    liquidityAssetsBurned,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityBurned",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let addFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.add(firstAssetAmount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  addFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.add(second_asset_amount);
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  let diffFromWallet = testUser1
    .getAsset(liquidityAssetId)
    ?.amountBefore.free!.sub(liquidityAssetsBurned);
  expect(testUser1.getAsset(liquidityAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  testUser2.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });

  diffFromWallet = pallet
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(firstAssetAmount);
  expect(pallet.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  diffFromWallet = pallet
    .getAsset(secondCurrency)
    ?.amountBefore.free!.sub(second_asset_amount);
  expect(pallet.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    poolBalanceBefore[0].sub(firstAssetAmount),
    poolBalanceBefore[1].sub(second_asset_amount),
  ]).collectionBnEqual(pool_balance);

  const total_liquidity_assets = await getAssetSupply(liquidityAssetId);
  expect(totalLiquidityAssetsBefore.sub(liquidityAssetsBurned)).bnEqual(
    total_liquidity_assets,
  );
});

test("xyk-pallet - Liqudity : Burn all the liquidity", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );
  const totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
  const liquidityAssetsBurned: BN =
    testUser1.getAsset(liquidityAssetId)?.amountBefore.free!;

  const [firstAssetAmount, secondAssetAmount] =
    await calcuate_burn_liquidity_price_local(
      firstCurrency,
      secondCurrency,
      liquidityAssetsBurned,
    );

  testLog
    .getLog()
    .info(
      "TestUser1: burning liquidity " +
        liquidityAssetsBurned +
        "of pool " +
        firstCurrency +
        " - " +
        secondCurrency,
    );

  await burnLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    liquidityAssetsBurned,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityBurned",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let addFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.add(firstAssetAmount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  addFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.add(secondAssetAmount);
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  let diffFromWallet = testUser1
    .getAsset(liquidityAssetId)
    ?.amountBefore.free!.sub(liquidityAssetsBurned);
  expect(testUser1.getAsset(liquidityAssetId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  testUser2.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });

  diffFromWallet = pallet
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(firstAssetAmount);
  expect(pallet.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  diffFromWallet = pallet
    .getAsset(secondCurrency)
    ?.amountBefore.free!.sub(secondAssetAmount);
  expect(pallet.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    poolBalanceBefore[0].sub(firstAssetAmount),
    poolBalanceBefore[1].sub(secondAssetAmount),
  ]).collectionBnEqual(pool_balance);

  const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
  expect(totalLiquidityAssetsBefore.sub(liquidityAssetsBurned)).bnEqual(
    totalLiquidityAssets,
  );
});

test("xyk-pallet - LiquidityOperation: mintLiquidity", async () => {
  const firstCurrencyAssetAmount = new BN(30000);
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );
  const totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
  const [secondAssetAmount, liquidityAssetsMinted] =
    await calcuate_mint_liquidity_price_local(
      firstCurrency,
      secondCurrency,
      firstCurrencyAssetAmount,
    );

  testLog
    .getLog()
    .info("User: minting liquidity " + firstCurrency + " - " + secondCurrency);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    firstCurrencyAssetAmount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "LiquidityMinted",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  let diffFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(firstCurrencyAssetAmount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  diffFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.sub(secondAssetAmount);
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  let addFromWallet = testUser1
    .getAsset(liquidityAssetId)
    ?.amountBefore.free!.add(liquidityAssetsMinted);
  expect(testUser1.getAsset(liquidityAssetId)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  testUser2.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });

  addFromWallet = pallet
    .getAsset(firstCurrency)
    ?.amountBefore.free!.add(firstCurrencyAssetAmount);
  expect(pallet.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  addFromWallet = pallet
    .getAsset(secondCurrency)
    ?.amountBefore.free!.add(secondAssetAmount);
  expect(pallet.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    poolBalanceBefore[0].add(firstCurrencyAssetAmount),
    poolBalanceBefore[1].add(secondAssetAmount),
  ]).collectionBnEqual(pool_balance);

  const total_liquidity_assets = await getAssetSupply(liquidityAssetId);
  expect(totalLiquidityAssetsBefore.add(liquidityAssetsMinted)).bnEqual(
    total_liquidity_assets,
  );
});
