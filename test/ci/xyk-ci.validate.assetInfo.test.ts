/*
 *
 * @group ci
 */
import { getApi, initApi } from "../../utils/api";
import { getAllAssetsInfo, getBalanceOfPool } from "../../utils/tx";
import { BN } from "@polkadot/util";
import {
  MGA_ASSET_ID,
  MGA_ASSET_NAME,
  KSM_ASSET_ID,
  KSM_ASSET_NAME,
  BTC_ASSET_ID,
  BTC_ASSET_NAME,
  USDC_ASSET_ID,
  USDC_ASSET_NAME,
} from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

test("xyk-CI - AssetInfo contains assets for MGA, mKSM, mBTC and mUSD", async () => {
  const assetsInfo = await getAllAssetsInfo();
  expect(assetsInfo).not.toBeUndefined();

  expect(
    assetsInfo.findIndex((asset) => asset.name === "Mangata")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === MGA_ASSET_NAME)
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === KSM_ASSET_NAME)
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === KSM_ASSET_NAME)
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === BTC_ASSET_NAME)
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === BTC_ASSET_NAME)
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === USDC_ASSET_NAME)
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === USDC_ASSET_NAME)
  ).toBeGreaterThanOrEqual(0);
});

test("xyk-CI - Check pools for MGA-mKSM, MGA-mBTC and MGA-mUSD", async () => {
  const balanceMGAKSM = await getBalanceOfPool(MGA_ASSET_ID, KSM_ASSET_ID);
  const balanceMGABTC = await getBalanceOfPool(MGA_ASSET_ID, BTC_ASSET_ID);
  const balanceMGAUSD = await getBalanceOfPool(MGA_ASSET_ID, USDC_ASSET_ID);

  expect(balanceMGAKSM[0]).not.toEqual(new BN(0));
  expect(balanceMGAKSM[1]).not.toEqual(new BN(0));

  expect(balanceMGABTC[0]).not.toEqual(new BN(0));
  expect(balanceMGABTC[1]).not.toEqual(new BN(0));

  expect(balanceMGAUSD[0]).not.toEqual(new BN(0));
  expect(balanceMGAUSD[1]).not.toEqual(new BN(0));
});
