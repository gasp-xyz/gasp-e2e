/*
 *
 * @group autocompound
 * @group story
 */
import { getApi, initApi } from "../../utils/api";
import { multiSwapBuy } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { User } from "../../utils/User";
import { getUserBalanceOfToken } from "../../utils/utils";
import { setupApi, setup5PoolsChained } from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_TEN_THOUSAND } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const successMultiSwapEventName = "AssetsMultiBuySwapped";
let users: User[] = [];
let tokenIds: BN[] = [];

describe("Multiswap - happy paths", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
  });
  test("[gasless] Happy path - multi-swap", async () => {
    const testUser1 = users[0];
    const multiSwapOutput = await multiSwapBuy(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
});
