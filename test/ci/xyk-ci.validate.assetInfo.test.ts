/*
 *
 * @group ci
 */
import { getApi, initApi } from "../../utils/api";
import { getAllAssetsInfo } from "../../utils/tx";
import { getBalanceOfPool } from "../../utils/tx";
import { BN } from "@polkadot/util";

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
    assetsInfo.findIndex((asset) => asset.symbol === "MGA")
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === "mKSM")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === "mKSM")
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === "mBTC")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === "mBTC")
  ).toBeGreaterThanOrEqual(0);

  expect(
    assetsInfo.findIndex((asset) => asset.name === "mUSD")
  ).toBeGreaterThanOrEqual(0);
  expect(
    assetsInfo.findIndex((asset) => asset.symbol === "mUSD")
  ).toBeGreaterThanOrEqual(0);
});

test("xyk-CI - Check pools for MGA-mKSM, MGA-mBTC and MGA-mUSD", async () => {
  const balanceMGAKSM = await getBalanceOfPool(new BN(0), new BN(4));
  const balanceMGABTC = await getBalanceOfPool(new BN(0), new BN(5));
  const balanceMGAUSD = await getBalanceOfPool(new BN(0), new BN(6));

  expect(balanceMGAKSM[0]).not.toEqual(new BN(0));
  expect(balanceMGAKSM[1]).not.toEqual(new BN(0));

  expect(balanceMGABTC[0]).not.toEqual(new BN(0));
  expect(balanceMGABTC[1]).not.toEqual(new BN(0));

  expect(balanceMGAUSD[0]).not.toEqual(new BN(0));
  expect(balanceMGAUSD[1]).not.toEqual(new BN(0));
});
