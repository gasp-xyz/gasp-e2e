/*
 *
 * @group xyk
 * @group calculate
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calculate_buy_price_id_rpc,
  calculate_buy_price_rpc,
  calculate_sell_price_id_rpc,
  calculate_sell_price_rpc,
  getBalanceOfPool,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Assets } from "../../utils/Assets";
import { getSudoUser } from "../../utils/setup";
import { testLog } from "../../utils/Logger";

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

describe("xyk-rpc - calculate_buy_price_by_id, calculate_sell_price_by_id", () => {
  const dictAssets = new Map<number, BN>();

  beforeAll(async () => {
    const sudo = getSudoUser();

    //the idea of this mess is to have some pools with different values,
    //pool1 [0,1]: with one,one value
    //pool2 [1,2]: with one,two value
    //pool3 [2,3]: with two,two value
    const assetIds = await Assets.setupUserWithCurrencies(
      sudo,
      [new BN(10), new BN(10), new BN(10), new BN(10), new BN(10)],
      sudo,
    );
    const assetValues = [1, 1, 2, 2, 3];
    for (let index = 0; index < assetIds.length; index++) {
      dictAssets.set(index, assetIds[index]);
      if (index < assetIds.length - 1) {
        await sudo.createPoolToAsset(
          new BN(assetValues[index]),
          new BN(assetValues[index + 1]),
          assetIds[index],
          assetIds[index + 1],
        );
      }
    }
  });
  //now with the dict indexes we do the testing.
  //ie, pool1, assets(0 and 1) in the dictionary, requesting amount of 0 , we expect 1. Weird.
  test.each([
    [0, 1, new BN(100), new BN(0)],
    [1, 0, new BN(100), new BN(0)],
    [1, 2, new BN(100), new BN(1)],
    [2, 1, new BN(100), new BN(0)],
    [3, 2, new BN(100), new BN(1)],
    [2, 3, new BN(100), new BN(1)],
  ])(
    "validate parameters - buy [soldTokenId->%s,boughtTokenId->%s,amount->%s,expected->%s]",
    async (soldTokenId, boughtTokenId, amount, expected) => {
      const poolBalance = await getBalanceOfPool(
        dictAssets.get(soldTokenId)!,
        dictAssets.get(boughtTokenId)!,
      );
      const priceBuy = await calculate_buy_price_id_rpc(
        dictAssets.get(soldTokenId)!,
        dictAssets.get(boughtTokenId)!,
        amount,
      );
      const priceBuyNoIds = await calculate_buy_price_rpc(
        poolBalance[0],
        poolBalance[1],
        amount,
      );
      expect(priceBuyNoIds).bnEqual(priceBuy);
      expect(priceBuy).bnEqual(expected);
    },
  );
  test.each([
    [0, 1, new BN(100), new BN(0)],
    [1, 0, new BN(100), new BN(0)],
    [1, 2, new BN(100), new BN(1)],
    [2, 1, new BN(100), new BN(0)],
    [3, 2, new BN(100), new BN(1)],
    [2, 3, new BN(100), new BN(1)],
  ])(
    "validate parameters - sell [soldTokenId->%s,boughtTokenId->%s,amount->%s,expected->%s]",
    async (soldTokenId, boughtTokenId, amount, expected) => {
      const poolBalance = await getBalanceOfPool(
        dictAssets.get(soldTokenId)!,
        dictAssets.get(boughtTokenId)!,
      );
      const priceBuy = await calculate_sell_price_id_rpc(
        dictAssets.get(soldTokenId)!,
        dictAssets.get(boughtTokenId)!,
        amount,
      );
      const priceBuyNoIds = await calculate_sell_price_rpc(
        poolBalance[0],
        poolBalance[1],
        amount,
      );
      expect(priceBuyNoIds).bnEqual(priceBuy);
      testLog.getLog().info("SoldId " + dictAssets.get(soldTokenId)!);
      testLog.getLog().info("BoughtId " + dictAssets.get(boughtTokenId)!);
      testLog.getLog().info("Expected " + expected);
      testLog.getLog().info("price " + priceBuy);
      //Goncer: This must be adapted to use market rpc and waiting for shoeb fixes. Leaving it failing.
      expect(priceBuy).bnEqual(expected);
    },
  );
});
