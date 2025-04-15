/*
 *
 * @group xyk
 * @group errors
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  rpcCalculateBuyPriceMulti,
  rpcCalculateBuyPriceMultiObj,
  rpcCalculateSellPriceMulti,
  rpcCalculateSellPriceMultiObj,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { Market, rpcGetPoolId } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let token1: BN;
let token2: BN;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  const [testUser] = setupUsers();
  [token1, token2] = await Assets.setupUserWithCurrencies(
    testUser,
    [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
    getSudoUser(),
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Sudo.sudoAs(
      testUser,
      Market.createPool(
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );
});

test.each([
  [
    new BN(1),
    new BN(1),
    new BN(-1),
    "createType(TokenId):: u32: Negative number passed to unsigned type",
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
    "createType(TokenId):: u32: Negative number passed to unsigned type",
  ],
  [
    new BN(-1),
    new BN(-1),
    new BN(-1),
    "createType(TokenId):: u32: Negative number passed to unsigned type",
  ],
])(
  "xyk-rpc - calculate_sell_price validates parameters - Negative params",
  async (overrideToken1, overrideToken2, amount, expected) => {
    const liqId = await rpcGetPoolId(token1, token2);
    await expect(
      rpcCalculateSellPriceMultiObj(
        liqId,
        token1.mul(overrideToken1),
        token2.mul(overrideToken2),
        amount,
      ),
    ).rejects.toThrow(expected.toString());

    await expect(
      rpcCalculateBuyPriceMultiObj(
        liqId,
        token1.mul(overrideToken1),
        token2.mul(overrideToken2),
        amount,
      ),
    ).rejects.toThrow(expected.toString());
  },
);

test.each([
  [
    new BN(1),
    new BN(1),
    new BN(0),
    "1: Unable to serve the request: Module, ModuleError { index: 22, error: [11, 0, 0, 0], message: None }",
  ],
  [
    new BN(0),
    new BN(0),
    new BN(0),
    "1: Unable to serve the request: Module, ModuleError { index: 22, error: [18, 0, 0, 0], message: None }",
  ],
  [
    new BN(1),
    new BN(1),
    new BN(1),
    "1: Unable to serve the request: Module, ModuleError { index: 22, error: [11, 0, 0, 0], message: None }",
  ],
  [
    new BN(0),
    new BN(0),
    new BN(1),
    "1: Unable to serve the request: Module, ModuleError { index: 22, error: [18, 0, 0, 0], message: None }",
  ],
])(
  "xyk-rpc - calculate_sell_price validates parameters - Zeroes [inputReserve->%s,outputReserve->%s,amount->%s,expected->%s]",
  async (overrideToken1, overrideToken2, amount, expected) => {
    const liqId = await rpcGetPoolId(token1, token2);
    await expect(
      rpcCalculateSellPriceMultiObj(
        liqId,
        token1.mul(overrideToken1),
        token2.mul(overrideToken2),
        amount,
      ),
    ).rejects.toThrow(expected.toString());
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
