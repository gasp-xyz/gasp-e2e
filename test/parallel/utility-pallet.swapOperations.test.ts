/*
 *
 * @group multiswap
 */
import { getApi, initApi } from "../../utils/api";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { User } from "../../utils/User";
import { setupApi, setup5PoolsChained, Extrinsic } from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_ONE, BN_HUNDRED, signTx } from "@mangata-finance/sdk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION } from "@mangata-finance/sdk";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { ApiPromise } from "@polkadot/api";
import { Tokens } from "../../utils/tokens";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let users: User[] = [];
let tokenIds: BN[] = [];
let api: ApiPromise;
let swapOperations: { [K: string]: Extrinsic } = {};

describe("Utility - forbidden batch", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
    api = await getApi();

    swapOperations = {
      multiswapSellAsset: Xyk.multiswapSellAsset(tokenIds, BN_HUNDRED, BN_ONE),
      multiswapBuyAsset: Xyk.multiswapBuyAsset(
        tokenIds,
        BN_HUNDRED,
        BN_MILLION
      ),
      sellAsset: Xyk.sellAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_ONE),
      buyAsset: Xyk.buyAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_MILLION),
    };
  });

  it.each(["multiswapSellAsset", "multiswapBuyAsset", "sellAsset", "buyAsset"])(
    "%s operation is not allowed in batchAll",
    async (operation) => {
      const extrinsic = swapOperations[operation];
      const events = await signTx(
        api,
        Sudo.batch(extrinsic),
        users[0].keyRingPair
      );
      const event = getEventResultFromMangataTx(events, [
        "system",
        "ExtrinsicFailed",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(event.data).toContain("CallFiltered");
    }
  );
  it.each(["multiswapSellAsset", "multiswapBuyAsset", "sellAsset", "buyAsset"])(
    "%s operation is not allowed in batch",
    async (operation) => {
      const extrinsic = swapOperations[operation];
      const events = await signTx(
        api,
        Sudo.singleBatch(extrinsic),
        users[1].keyRingPair
      );
      const event = getEventResultFromMangataTx(events, [
        "utility",
        "BatchInterrupted",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      expect(event.data).toContain("BatchInterrupted");
    }
  );
  it.each(["multiswapSellAsset", "multiswapBuyAsset", "sellAsset", "buyAsset"])(
    "%s operation is not allowed in forceBatch",
    async (operation) => {
      const extrinsic = swapOperations[operation];
      const events = await signTx(
        api,
        Sudo.forceBatch(extrinsic),
        users[2].keyRingPair
      );
      const event = getEventResultFromMangataTx(events, [
        "utility",
        "BatchInterrupted",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      expect(event.data).toContain("BatchInterrupted");
    }
  );
  it.each(["multiswapSellAsset", "multiswapBuyAsset", "sellAsset", "buyAsset"])(
    "%s operation is not allowed in singleBatch with some allowed",
    async (operation) => {
      const extrinsic = swapOperations[operation];
      const transfer = Tokens.transfer(users[1], MGA_ASSET_ID);
      const events = await signTx(
        api,
        Sudo.singleBatch(...[transfer, extrinsic]),
        users[3].keyRingPair
      );
      const event = getEventResultFromMangataTx(events, [
        "utility",
        "BatchInterrupted",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      expect(event.data).toContain(
        '{"error": {"Module": {"error": "0x05000000", "index": "0"}}, "index": "1"}'
      );
    }
  );
});
