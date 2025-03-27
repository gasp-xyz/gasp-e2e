/*
 *
 * @group multiswap
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  multiSwapBuyMarket,
  multiSwapSellMarket,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { User, AssetWallet } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import {
  getEventErrorByMetadata,
  getUserBalanceOfToken,
  stringToBN,
} from "../../utils/utils";
import {
  setupApi,
  setup5PoolsChained,
  getSudoUser,
  setupUsers,
} from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_BILLION, BN_TEN_THOUSAND, BN_ZERO } from "gasp-sdk";
import { ApiPromise } from "@polkadot/api";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let users: User[] = [];
let tokenIds: BN[] = [];
let api: ApiPromise;
describe("Multiswap - error cases: disabled tokens", () => {
  // Aleks: we changed the way to catch the error
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
  });
  //enable the tokens for the following test!
  beforeEach(async () => {
    for (let index = 0; index < tokenIds.length; index++) {
      const tokenId = tokenIds[index];
      await Assets.enableToken(tokenId);
    }
  });
  it.each([0])(
    "[gasless] disabled on token of the chained polls",
    async (position: number) => {
      await Assets.disableToken(tokenIds[position]);
      const testUser1 = users[0];
      //comment from Gonzalo: "We can leave it now, but it looks like a bug"
      const event = await multiSwapBuyMarket(
        testUser1,
        tokenIds,
        new BN(1000),
        BN_TEN_THOUSAND,
      );

      const error = await getEventErrorByMetadata(event, "SwapFailed");
      expect(error).toEqual("FunctionNotAvailableForThisToken");
    },
  );
  it.each([2, 4])(
    "[gasless] disabled on token of the chained polls - Fail on tx execution-%s",
    async (position: number) => {
      await Assets.disableToken(tokenIds[position]);
      const testUser1 = users[0];
      const tokenBefore = await getUserBalanceOfToken(
        tokenIds[tokenIds.length - 1],
        testUser1,
      );
      const multiSwapOutput = await multiSwapBuyMarket(
        testUser1,
        tokenIds,
        new BN(1000),
        BN_TEN_THOUSAND,
      );
      const error = await getEventErrorByMetadata(
        multiSwapOutput,
        "SwapFailed",
      );
      expect(error).toEqual("FunctionNotAvailableForThisToken");

      const boughtTokens = await getUserBalanceOfToken(
        tokenIds[tokenIds.length - 1],
        testUser1,
      );
      expect(tokenBefore.free.sub(boughtTokens.free)).bnEqual(BN_ZERO);
    },
  );
});
describe("Multiswap - error cases: pool status & gasless integration", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    api = getApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
  });
  test.skip("[gasless] High value swaps are disabled on multiswap", async () => {
    const testUser0 = users[0];
    const meta = await api.query.feeLock.feeLockMetadata();
    const threshold = stringToBN(
      JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
    );
    const feeLockAmount = stringToBN(
      JSON.parse(JSON.stringify(meta)).feeLockAmount.toString(),
    );
    let tokenList = tokenIds.concat(GASP_ASSET_ID);
    tokenList = tokenList.reverse();
    testUser0.addAssets(tokenList);
    await testUser0.refreshAmounts(AssetWallet.BEFORE);

    await multiSwapSellMarket(testUser0, tokenList, threshold.addn(10));

    await testUser0.refreshAmounts(AssetWallet.AFTER);
    const diff = testUser0.getWalletDifferences();
    expect(
      diff.find((x) => x.currencyId === GASP_ASSET_ID)?.diff.reserved,
    ).bnEqual(feeLockAmount);
  });
  test("[gasless] Fail on client when not enough MGAs to lock AND tokens that exist whitelist", async () => {
    //Aleks: I changed the error, but I think we also need to change description
    const [testUser1] = setupUsers();
    const sudo = getSudoUser();
    await Sudo.batchAsSudoFinalized(Assets.mintToken(tokenIds[0], testUser1));
    const meta = await api.query.feeLock.feeLockMetadata();
    //TODO:Update whitelist!
    const threshold = stringToBN(
      JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
    );

    await updateFeeLockMetadata(
      sudo,
      undefined,
      undefined,
      undefined,
      tokenIds.map((x) => [x, true]),
    );
    const event = await multiSwapSellMarket(
      testUser1,
      tokenIds,
      threshold.addn(10),
    );

    const error = await getEventErrorByMetadata(event, "SwapFailed");
    expect(error).toEqual("NotEnoughAssetsForFeeLock");
  });
  test.skip("[gasless] Fail on swap when selling remove all MGAs", async () => {
    const testUser = users[1];
    let tokenList = tokenIds.concat(GASP_ASSET_ID);
    tokenList = tokenList.reverse();
    testUser.addAssets(tokenList);
    await testUser.refreshAmounts(AssetWallet.BEFORE);
    const events = await multiSwapSellMarket(
      testUser,
      tokenList,
      testUser.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const swapErrorEvent = await getEventResultFromMangataTx(events, [
      "MultiSwapAssetFailedOnAtomicSwap",
    ]);
    expect(swapErrorEvent.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const diff = testUser.getWalletDifferences();
    expect(diff).toHaveLength(1);
    expect(diff[0].diff.reserved).bnGt(new BN(0));
    expect(diff[0].diff.free).bnLt(diff[0].diff.reserved.neg());
  });
  test("[gasless] Fails on client when pool does not exist", async () => {
    const testUser = users[1];
    testUser.addAssets(tokenIds);
    await testUser.refreshAmounts(AssetWallet.BEFORE);
    let exception = false;
    await expect(
      multiSwapSellMarket(
        testUser,
        tokenIds.concat(BN_BILLION),
        new BN(12345),
      ).catch((reason) => {
        exception = true;
        throw new Error(reason.data);
      }),
    ).rejects.toThrow("");
    expect(exception).toBeTruthy();

    await testUser.refreshAmounts(AssetWallet.AFTER);
    const diff = testUser.getWalletDifferences();
    expect(diff).toHaveLength(0);
  });
});
