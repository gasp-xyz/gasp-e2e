import BN from "bn.js";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import {
  getAssetSupply,
  getBalanceOfPool,
  getLiquidityAssetId,
  getTreasury,
  getTreasuryBurn,
} from "./tx";
import { AssetWallet, User } from "./User";
import {
  calculateCompleteFees,
  calculateFees,
  calculateLiqAssetAmount,
  fromBNToUnitString,
} from "./utils";

export function validateTransactionSucessful(
  eventResult: EventResult,
  tokensAmount: number,
  user: User
) {
  expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  expect(eventResult.data[1]).toEqual(user.keyRingPair.address);
  expect(eventResult.data[2]).toEqual(fromBNToUnitString(new BN(tokensAmount)));
}

export function validateEmptyAssets(assets: BN[]) {
  assets.forEach((asset) => expect(asset.toString()).toEqual("0"));
}

export function validateAssetsWithValues(assets: BN[], values: number[]) {
  for (let idx = 0; idx < values.length; idx++) {
    expect(assets[idx].toString()).toEqual(values[idx].toString());
  }
  expect(assets).toHaveLength(values.length);
}

export function validatePoolCreatedEvent(
  result: EventResult,
  userAddress: string,
  firstCurrency: BN,
  first_asset_amount: BN,
  secondCurrency: BN,
  second_asset_amount: BN
) {
  //validate the pool created event contract.
  const rawData = result.data;
  expect(rawData).not.toBeNull();
  expect(rawData[0]).toEqual(userAddress);
  expect(parseInt(rawData[1])).toEqual(parseInt(firstCurrency.toString()));
  expect(rawData[2].toString()).toEqual(fromBNToUnitString(first_asset_amount));
  expect(parseInt(rawData[3])).toEqual(parseInt(secondCurrency.toString()));
  expect(rawData[4].toString()).toEqual(
    fromBNToUnitString(second_asset_amount)
  );
}

export function validateAssetsSwappedEvent(
  result: EventResult,
  userAddress: string,
  firstCurrency: BN,
  first_asset_amount: BN,
  secondCurrency: BN,
  second_asset_amount: BN
) {
  //validate the asset swapped created event contract.
  validatePoolCreatedEvent(
    result,
    userAddress,
    firstCurrency,
    first_asset_amount,
    secondCurrency,
    second_asset_amount
  );
}

export function validateMintedLiquidityEvent(
  result: EventResult,
  address: string,
  firstCurrency: BN,
  firstCurerncyAmount: BN,
  secondCurrency: BN,
  secondCurrencyAmount: BN,
  liquidityAssetId: BN,
  txAmount: BN
) {
  const rawData = result.data;
  expect(rawData).not.toBeNull();
  expect(rawData[0]).toEqual(address);
  expect(rawData[1]).toEqual(firstCurrency.toString());
  expect(rawData[2].toString()).toEqual(
    fromBNToUnitString(firstCurerncyAmount)
  );
  expect(rawData[3]).toEqual(secondCurrency.toString());
  expect(rawData[4].toString()).toEqual(
    fromBNToUnitString(secondCurrencyAmount)
  );
  expect(rawData[5].toString()).toEqual(liquidityAssetId.toString());
  expect(rawData[6].toString()).toEqual(fromBNToUnitString(txAmount));
}

export async function validateStatusWhenPoolCreated(
  firstCurrency: BN,
  secondCurrency: BN,
  testUser1: User,
  pool_balance_before: BN[],
  total_liquidity_assets_before: BN,
  first_asset_amount: BN = new BN(50000),
  second_asset_amount: BN = new BN(50000)
) {
  const liquidity_asset_id = await getLiquidityAssetId(
    firstCurrency,
    secondCurrency
  );
  const liquidity_assets_minted = calculateLiqAssetAmount(
    first_asset_amount,
    second_asset_amount
  );

  testUser1.addAsset(liquidity_asset_id, new BN(0));

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  let diffFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore!.sub(first_asset_amount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter!).bnEqual(
    diffFromWallet!
  );

  diffFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore!.sub(second_asset_amount);
  expect(testUser1.getAsset(secondCurrency)?.amountAfter!).bnEqual(
    diffFromWallet!
  );

  await testUser1.validateWalletIncreased(
    liquidity_asset_id,
    liquidity_assets_minted
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
  ]).collectionBnEqual(pool_balance);

  const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
  expect([
    pool_balance_before[0].add(first_asset_amount),
    pool_balance_before[1].add(second_asset_amount),
  ]).collectionBnEqual([balance[1], balance[0]]);

  const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
  expect(total_liquidity_assets_before.add(liquidity_assets_minted)).bnEqual(
    total_liquidity_assets
  );
}

export async function validateUnmodified(
  firstCurrency: BN,
  secondCurrency: BN,
  testUser1: User,
  pool_balance_before: BN[]
) {
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  testUser1.assets.forEach((asset) => {
    expect(asset.amountBefore).bnEqual(asset.amountAfter);
  });

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([pool_balance_before[0], pool_balance_before[1]]).toEqual(
    pool_balance
  );

  const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
  expect([pool_balance_before[0], pool_balance_before[1]]).toEqual([
    balance[1],
    balance[0],
  ]);
}

export async function validateTreasuryAmountsEqual(
  assetId: BN,
  treasuryExpectation: BN[]
) {
  const [expectedTreasury, expectedTreasuryBurn] = treasuryExpectation;
  const treasuryAsset = await getTreasury(assetId);
  const treasuryBurn = await getTreasuryBurn(assetId);

  expect(treasuryAsset).bnEqual(expectedTreasury);
  expect(treasuryBurn).bnEqual(expectedTreasuryBurn);
}

export async function validateUserPaidFeeForFailedTx(
  soldAmount: BN,
  user: User,
  assetSoldId: BN,
  failedBoughtAssetId: BN,
  poolAmountFailedBought: BN,
  initialPoolValueSoldAssetId: BN
) {
  const { treasury, treasuryBurn } = calculateFees(soldAmount);
  const { completeFee } = calculateCompleteFees(soldAmount);

  //when failed Tx, we remove 3% and put it in the pool.
  await user.refreshAmounts(AssetWallet.AFTER);
  const diffFromWallet = user
    .getAsset(assetSoldId)
    ?.amountBefore!.sub(completeFee);
  expect(user.getAsset(assetSoldId)?.amountAfter!).bnEqual(diffFromWallet!);

  //second wallet should not be modified.
  const amount = user.getAsset(failedBoughtAssetId)?.amountBefore!;
  expect(user.getAsset(failedBoughtAssetId)?.amountAfter!).bnEqual(amount);

  const treasuryTokens = await getTreasury(assetSoldId);
  const treasuryBurnTokens = await getTreasuryBurn(assetSoldId);
  expect(treasuryTokens).bnEqual(treasury);
  expect(treasuryBurnTokens).bnEqual(treasuryBurn);

  const increasedInPool = completeFee.sub(treasury.add(treasuryBurn));
  const poolBalances = await getBalanceOfPool(assetSoldId, failedBoughtAssetId);
  expect(poolBalances[0]).bnEqual(
    initialPoolValueSoldAssetId.add(increasedInPool)
  );
  expect(poolBalances[1]).bnEqual(poolAmountFailedBought);
}
