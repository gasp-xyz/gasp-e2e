import { ApiPromise } from "@polkadot/api";
import { Codec } from "@polkadot/types-codec/types";
import { BN, BN_FOUR } from "@polkadot/util";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import { CodecOrArray, toHex, toHuman, toJson } from "./setup";
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
  fromStringToUnitString,
  stringToBN,
} from "./utils";
import { getApi } from "./api";
import { BN_TEN } from "gasp-sdk";

export function validateTransactionSucessful(
  eventResult: EventResult,
  tokensAmount: number,
  user: User,
) {
  expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  expect(eventResult.data[1]).toEqual(user.keyRingPair.address);
  expect(fromStringToUnitString(eventResult.data[2])).toEqual(
    fromBNToUnitString(new BN(tokensAmount)),
  );
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
  second_asset_amount: BN,
) {
  //validate the pool created event contract.
  const rawData = result.data;
  expect(rawData).not.toBeNull();
  expect(rawData[0]).toEqual(userAddress);
  expect(parseInt(rawData[1])).toEqual(parseInt(firstCurrency.toString()));
  expect(fromStringToUnitString(rawData[2])).toEqual(
    fromBNToUnitString(first_asset_amount),
  );
  expect(parseInt(rawData[3])).toEqual(parseInt(secondCurrency.toString()));
  expect(fromStringToUnitString(rawData[4])).toEqual(
    fromBNToUnitString(second_asset_amount),
  );
}

export function validateAssetsSwappedEvent(
  result: EventResult,
  userAddress: string,
  firstCurrency: BN,
  firstAssetAmount: BN,
  secondCurrency: BN,
  secondAssetAmount: BN,
) {
  //validate the asset swapped created event contract.
  const rawData = result.data;
  expect(rawData).not.toBeNull();
  //@ts-ignore
  expect(rawData.who).toEqual(userAddress);
  //@ts-ignore
  expect(stringToBN(rawData.totalAmountIn)).toEqual(firstAssetAmount);
  //@ts-ignore
  expect(stringToBN(rawData.swaps[0].assetIn.toString())).bnEqual(
    stringToBN(firstCurrency.toString()),
  );
  //@ts-ignore
  expect(stringToBN(rawData.swaps[0].assetOut.toString())).bnEqual(
    stringToBN(secondCurrency.toString()),
  );
  //@ts-ignore
  expect(stringToBN(rawData.swaps[0].amountOut.toString())).bnEqual(
    stringToBN(secondAssetAmount.toString()),
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
  txAmount: BN,
) {
  const rawData = result.data;
  expect(rawData).not.toBeNull();
  expect(rawData[0]).toEqual(address);
  expect(rawData[1]).toEqual(firstCurrency.toString());
  expect(fromStringToUnitString(rawData[2])).toEqual(
    fromBNToUnitString(firstCurerncyAmount),
  );
  expect(rawData[3]).toEqual(secondCurrency.toString());
  expect(fromStringToUnitString(rawData[4])).toEqual(
    fromBNToUnitString(secondCurrencyAmount),
  );
  expect(rawData[5].toString()).toEqual(liquidityAssetId.toString());
  expect(fromStringToUnitString(rawData[6])).toEqual(
    fromBNToUnitString(txAmount),
  );
}

export async function validateStatusWhenPoolCreated(
  firstCurrency: BN,
  secondCurrency: BN,
  testUser1: User,
  pool_balance_before: BN[],
  total_liquidity_assets_before: BN,
  first_asset_amount: BN = new BN(50000),
  second_asset_amount: BN = new BN(50000),
) {
  const liquidity_asset_id = await getLiquidityAssetId(
    firstCurrency,
    secondCurrency,
  );
  const liquidity_assets_minted = calculateLiqAssetAmount(
    first_asset_amount,
    second_asset_amount,
  );

  testUser1.addAsset(liquidity_asset_id, new BN(0));

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  let diffFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(first_asset_amount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  diffFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.sub(second_asset_amount);
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  const addFromWallet = testUser1
    .getAsset(liquidity_asset_id)
    ?.amountBefore.free!.add(liquidity_assets_minted);
  expect(testUser1.getAsset(liquidity_asset_id)?.amountAfter.free!).bnEqual(
    addFromWallet!,
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
    total_liquidity_assets,
  );
}

export async function validateUnmodified(
  firstCurrency: BN,
  secondCurrency: BN,
  testUser1: User,
  pool_balance_before: BN[],
) {
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  testUser1.getFreeAssetAmounts().forEach((asset) => {
    expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
  });

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect([pool_balance_before[0], pool_balance_before[1]]).collectionBnEqual(
    pool_balance,
  );

  const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
  expect([pool_balance_before[0], pool_balance_before[1]]).collectionBnEqual([
    balance[1],
    balance[0],
  ]);
}

export async function validateTreasuryAmountsEqual(
  assetId: BN,
  treasuryExpectation: BN[],
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
  initialPoolValueSoldAssetId: BN,
  roundingIssue = BN_FOUR,
) {
  const { treasury, treasuryBurn } = calculateFees(soldAmount);
  let { completeFee } = calculateCompleteFees(soldAmount);

  //when failed Tx, we remove 3% and put it in the pool.
  //first wallet should not be modified.
  //roundingISSUES - 2
  //https://mangatafinance.atlassian.net/browse/GASP-1869
  completeFee = completeFee.add(roundingIssue);

  await user.refreshAmounts(AssetWallet.AFTER);
  const diffFromWallet = user
    .getAsset(assetSoldId)
    ?.amountBefore.free!.sub(completeFee);
  expect(user.getAsset(assetSoldId)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  //second wallet should not be modified.
  const amount = user.getAsset(failedBoughtAssetId)?.amountBefore!;
  expect(user.getAsset(failedBoughtAssetId)?.amountAfter.free!).bnEqual(
    amount.free,
  );
  const treasuryTokens = await getTreasury(assetSoldId);
  const treasuryBurnTokens = await getTreasuryBurn(assetSoldId);
  expect(treasuryTokens).bnEqual(treasury);

  //roundingISSUES - 2
  //https://mangatafinance.atlassian.net/browse/GASP-1869
  expect(treasuryBurnTokens.div(BN_TEN)).bnEqual(treasuryBurn.div(BN_TEN));

  const increasedInPool = completeFee.sub(treasury.add(treasuryBurn));
  const poolBalances = await getBalanceOfPool(assetSoldId, failedBoughtAssetId);

  //roundingISSUES - 2
  //https://mangatafinance.atlassian.net/browse/GASP-1869
  expect(poolBalances[0].div(BN_TEN)).bnEqual(
    initialPoolValueSoldAssetId.add(increasedInPool).div(BN_TEN),
  );
  expect(poolBalances[1]).bnEqual(poolAmountFailedBought);
}

// data & event matchers

export const matchSnapshot = (
  codec: CodecOrArray | Promise<CodecOrArray>,
  message?: string,
) => {
  return expect(Promise.resolve(codec).then(toHuman)).resolves.toMatchSnapshot(
    message,
  );
};

export const expectEvent = (codec: CodecOrArray, event: any) => {
  return expect(toHuman(codec)).toEqual(
    expect.arrayContaining([expect.objectContaining(event)]),
  );
};

export const expectHuman = (codec: CodecOrArray) => {
  return expect(toHuman(codec));
};

export const expectJson = (codec: CodecOrArray) => {
  return expect(toJson(codec));
};

export const expectHex = (codec: CodecOrArray) => {
  return expect(toHex(codec));
};

type EventFilter = string | { method: string; section: string };

const _matchEvents = async (
  msg: string,
  events: Promise<Codec[] | Codec>,
  ...filters: EventFilter[]
) => {
  let data = toHuman(await events).map(
    ({ event: { index: _, ...event } }: any) => event,
  );
  if (filters) {
    const filtersArr = Array.isArray(filters) ? filters : [filters];
    data = data.filter((evt: any) => {
      return filtersArr.some((filter) => {
        if (typeof filter === "string") {
          return evt.section === filter;
        }
        const { section, method } = filter;
        return evt.section === section && evt.method === method;
      });
    });
  }
  return expect(data).toMatchSnapshot(msg);
};

export const matchEvents = async (
  events: Promise<Codec[] | Codec> | Codec[],
  ...filters: EventFilter[]
) => {
  return _matchEvents("events", redact(events), ...filters);
};

export const matchSystemEvents = async (
  { api }: { api: ApiPromise },
  ...filters: EventFilter[]
) => {
  await _matchEvents(
    "system events",
    redact(api.query.system.events()),
    ...filters,
  );
};
export const matchSystemEventsAt = async (
  { api }: { api: ApiPromise },
  blockHashAt: string,
  ...filters: EventFilter[]
) => {
  await _matchEvents(
    "system events",
    redact((await api.at(blockHashAt)).query.system.events()),
    ...filters,
  );
};

export const matchUmp = async ({ api }: { api: ApiPromise }) => {
  expect(await api.query.parachainSystem.upwardMessages()).toMatchSnapshot(
    "ump",
  );
};

export const redact = async (data: any | Promise<any>) => {
  const json = toHuman(await data);

  const process = (obj: any): any => {
    if (obj == null) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(process);
    }
    if (typeof obj === "number") {
      return "(redacted)";
    }
    if (typeof obj === "string") {
      if (obj.match(/^[\d,]+$/) || obj.match(/0x[0-9a-f]{64}/)) {
        return "(redacted)";
      }
      return obj;
    }
    if (typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, process(v)]),
      );
    }
    return obj;
  };

  return process(json);
};

export const expectExtrinsicSuccess = (events: Codec[]) => {
  expectEvent(events, {
    event: expect.objectContaining({
      method: "ExtrinsicSuccess",
      section: "system",
    }),
  });
};
export async function checkMaintenanceStatus(
  maintenanceModeValue: boolean,
  upgradableValue: boolean,
) {
  const api = getApi();
  const maintenanceStatus = await api.query.maintenance.maintenanceStatus();
  expect(maintenanceStatus.isMaintenance.isTrue).toEqual(maintenanceModeValue);
  expect(maintenanceStatus.isUpgradableInMaintenance.isTrue).toEqual(
    upgradableValue,
  );
}
export async function validateUpdateInMaintenanceModeStatus(
  events: EventResult,
) {
  const api = getApi();
  const maintenanceStatus = await api.query.maintenance.maintenanceStatus();
  if (!maintenanceStatus.isUpgradableInMaintenance.isTrue) {
    expect(events.data).toEqual("UpgradeBlockedByMaintenance");
    expect(ExtrinsicResult.ExtrinsicFailed).toEqual(events.state);
  } else {
    expect(events.data).toEqual("FailedToExtractRuntimeVersion");
    expect(ExtrinsicResult.ExtrinsicFailed).toEqual(events.state);
  }
}
