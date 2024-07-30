/*
 *
 * @group multiswap
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN, hexToU8a, hexToBn } from "@polkadot/util";
import { User } from "../../utils/User";
import { setupApi, setup5PoolsChained, Extrinsic } from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_ONE, BN_HUNDRED, signTx } from "gasp-sdk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION } from "gasp-sdk";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { ApiPromise } from "@polkadot/api";
import { Tokens } from "../../utils/tokens";
import { getLiquidityAssetId } from "../../utils/tx";
import { Staking } from "../../utils/Staking";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let users: User[] = [];
let tokenIds: BN[] = [];
let api: ApiPromise;
let swapOperations: { [K: string]: Extrinsic } = {};
const errorEnum = '"error":"0x05000000"';
const enumValue = "0x05000000";

test.skip("Validate that the error enum is about filtered call", async () => {
  const error = hexToBn(enumValue);
  const index = hexToU8a("0");
  const err = api?.registry.findMetaError({
    error: error,
    index: new BN(index),
  });
  expect(err).toContain("CallFiltered");
});

describe("Utility - batched swaps are not allowed", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
    api = await getApi();
    //last asset is mangata paired
    const liq = await getLiquidityAssetId(
      tokenIds[tokenIds.length - 1],
      GASP_ASSET_ID,
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(Staking.addStakingLiquidityToken(liq)),
      Assets.promotePool(liq.toNumber(), 20),
    );

    swapOperations = {
      multiswapSellAsset: Xyk.multiswapSellAsset(tokenIds, BN_HUNDRED, BN_ONE),
      multiswapBuyAsset: Xyk.multiswapBuyAsset(
        tokenIds,
        BN_HUNDRED,
        BN_MILLION,
      ),
      sellAsset: Xyk.sellAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_ONE),
      buyAsset: Xyk.buyAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_MILLION),
      compoundRewards: Xyk.compoundRewards(liq),
      provideLiquidity: Xyk.provideLiquidity(liq, tokenIds[0], BN_HUNDRED),
    };
  });
  it.each([
    "multiswapSellAsset",
    "multiswapBuyAsset",
    "sellAsset",
    "buyAsset",
    "compoundRewards",
    "provideLiquidity",
  ])("%s operation is not allowed in batchAll", async (operation) => {
    const extrinsic = swapOperations[operation];
    const events = await signTx(
      api,
      Sudo.batch(extrinsic),
      users[0].keyRingPair,
    );
    const event = getEventResultFromMangataTx(events, [
      "system",
      "ExtrinsicFailed",
    ]);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(event.data).toContain("CallFiltered");
  });
  it.each([
    "multiswapSellAsset",
    "multiswapBuyAsset",
    "sellAsset",
    "buyAsset",
    "compoundRewards",
    "provideLiquidity",
  ])("%s operation is not allowed in batch", async (operation) => {
    const extrinsic = swapOperations[operation];
    const events = await signTx(
      api,
      Sudo.singleBatch(extrinsic),
      users[1].keyRingPair,
    );
    const event = getEventResultFromMangataTx(events, [
      "utility",
      "BatchInterrupted",
    ]);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    expect(JSON.stringify(event.data)).toContain(errorEnum);
  });
  it.each([
    "multiswapSellAsset",
    "multiswapBuyAsset",
    "sellAsset",
    "buyAsset",
    "compoundRewards",
    "provideLiquidity",
  ])("%s operation is not allowed in forceBatch", async (operation) => {
    const extrinsic = swapOperations[operation];
    const events = await signTx(
      api,
      Sudo.forceBatch(extrinsic),
      users[2].keyRingPair,
    );
    const event = getEventResultFromMangataTx(events, [
      "utility",
      "ItemFailed",
    ]);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    expect(JSON.stringify(event.data)).toContain(errorEnum);
  });
  it.each([
    "multiswapSellAsset",
    "multiswapBuyAsset",
    "sellAsset",
    "buyAsset",
    "compoundRewards",
    "provideLiquidity",
  ])(
    "%s operation is not allowed in singleBatch with some allowed",
    async (operation) => {
      const extrinsic = swapOperations[operation];
      const transfer = Tokens.transfer(users[1], GASP_ASSET_ID);
      const events = await signTx(
        api,
        Sudo.singleBatch(...[transfer, extrinsic]),
        users[3].keyRingPair,
      );
      const event = getEventResultFromMangataTx(events, [
        "utility",
        "BatchInterrupted",
      ]);
      expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      expect(JSON.stringify(event.data)).toContain(errorEnum);
    },
  );
});
