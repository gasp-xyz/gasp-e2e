/*
 *
 * @group xyk
 * @group errors
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calculate_buy_price_rpc,
  calculate_sell_price_rpc,
  rpcCalculateBuyPriceMulti,
  rpcCalculateSellPriceMulti,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { setupApi } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
});

test.each([
  [
    new BN(-1),
    new BN(-1),
    new BN(-1),
    "createType(Balance):: Balance: Negative number passed to unsigned type",
  ],
  [
    new BN(1),
    new BN(-1),
    new BN(1),
    "createType(Balance):: Balance: Negative number passed to unsigned type",
  ],
  [
    new BN(-1),
    new BN(1),
    new BN(1),
    "createType(Balance):: Balance: Negative number passed to unsigned type",
  ],
])(
  "xyk-rpc - calculate_sell_price validates parameters - Negative params",
  async (input_reserve, output_reserve, amount, expected) => {
    await expect(
      calculate_sell_price_rpc(input_reserve, output_reserve, amount),
    ).rejects.toThrow(expected.toString());

    await expect(
      calculate_buy_price_rpc(input_reserve, output_reserve, amount),
    ).rejects.toThrow(expected.toString());
  },
);

test.each([
  [new BN(1), new BN(1), new BN(0), new BN(0)],
  [new BN(0), new BN(0), new BN(0), new BN(0)],
  [new BN(0), new BN(1), new BN(1), new BN(1)],
  [new BN(0), new BN(0), new BN(1), new BN(0)],
])(
  "xyk-rpc - calculate_sell_price validates parameters - Zeroes [inputReserve->%s,outputReserve->%s,amount->%s,expected->%s]",
  async (input_reserve, output_reserve, amount, expected) => {
    const priceSell = await calculate_sell_price_rpc(
      input_reserve,
      output_reserve,
      amount,
    );
    expect(priceSell).bnEqual(expected);
  },
);

test.each([
  [
    new BN(-1),
    new BN(0),
    new BN(0),
    "createType(Vec<TokenId>):: u32: Negative number passed to unsigned type",
  ],
  [
    new BN(0),
    new BN(-1),
    new BN(0),
    "createType(Vec<TokenId>):: u32: Negative number passed to unsigned type",
  ],
])(
  "validate parameters: negative asset ids [soldTokenId->%s,boughtTokenId->%s,amount->%s,expected->%s]",
  async (soldTokenId, boughtTokenId, amount, expected) => {
    await expect(
      rpcCalculateBuyPriceMulti(new BN(-1), boughtTokenId, amount, soldTokenId),
    ).rejects.toThrow(expected.toString());

    await expect(
      rpcCalculateSellPriceMulti(
        new BN(-1),
        boughtTokenId,
        amount,
        soldTokenId,
      ),
    ).rejects.toThrow(expected.toString());
  },
);
