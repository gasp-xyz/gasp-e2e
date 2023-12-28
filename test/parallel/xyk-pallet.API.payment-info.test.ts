/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { ApiPromise } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";

import { BN } from "@polkadot/util";
import {
  KSM_ASSET_ID,
  MGA_ASSET_ID,
  TUR_ASSET_ID,
} from "../../utils/Constants";
import { BN_HUNDRED, BN_MILLION, BN_ZERO, signTx } from "@mangata-finance/sdk";
import { Xyk } from "../../utils/xyk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let api: ApiPromise;
let testUser: User;
let liqId: BN;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await setupApi();
  api = getApi();

  // setup users
  [testUser] = setupUsers();

  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
});

test("GIVEN a paymentInfo request, WHEN extrinsic is sellAsset  THEN zero is returned.", async () => {
  const sellAssetEvent = api.tx.xyk.sellAsset(
    MGA_ASSET_ID,
    KSM_ASSET_ID,
    new BN(1000),
    BN_ZERO,
  );

  const sellAssetPaymentInfo = await sellAssetEvent.paymentInfo(
    testUser.keyRingPair,
  );
  expect(sellAssetPaymentInfo.partialFee).bnEqual(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is multiswapBuyAsset THEN  zero is returned", async () => {
  const multiswapBuyEvent = api.tx.xyk.multiswapBuyAsset(
    [MGA_ASSET_ID, KSM_ASSET_ID],
    BN_HUNDRED,
    BN_MILLION,
  );

  const multiswapBuyPaymentInfo = await multiswapBuyEvent.paymentInfo(
    testUser.keyRingPair,
  );

  expect(multiswapBuyPaymentInfo.partialFee).bnEqual(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is mintLiquidityEvent THEN non-zero is returned", async () => {
  const mintLiquidityEvent = api.tx.xyk.mintLiquidity(
    MGA_ASSET_ID,
    KSM_ASSET_ID,
    BN_HUNDRED,
    new BN(Number.MAX_SAFE_INTEGER),
  );

  const mintLiquidityPaymentInfo = await mintLiquidityEvent.paymentInfo(
    testUser.keyRingPair,
  );

  expect(mintLiquidityPaymentInfo.partialFee).bnGt(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is compoundRewards THEN non-zero is returned", async () => {
  const compoundRewardsEvent = api.tx.xyk.compoundRewards(liqId, 1000000);

  const compoundRewardsPaymentInfo = await compoundRewardsEvent.paymentInfo(
    testUser.keyRingPair,
  );

  expect(compoundRewardsPaymentInfo.partialFee).bnGt(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is provideLiquidityWithId THEN non-zero is returned", async () => {
  const provideLiquidityEvent = api.tx.xyk.provideLiquidityWithConversion(
    liqId,
    MGA_ASSET_ID,
    BN_HUNDRED,
  );

  const provideLiquidityPaymentInfo = await provideLiquidityEvent.paymentInfo(
    testUser.keyRingPair,
  );

  expect(provideLiquidityPaymentInfo.partialFee).bnGt(BN_ZERO);
});

test("GIVEN a paymentInfo request, WHEN extrinsic is a batch with a sell/buy operation THEN non-zero is returned AND the extrinsic will fail because sell/buy are forbidden in batches tx", async () => {
  const batchAllEvent = api.tx.utility.batchAll([
    Xyk.buyAsset(MGA_ASSET_ID, KSM_ASSET_ID, BN_HUNDRED),
    Xyk.buyAsset(MGA_ASSET_ID, TUR_ASSET_ID, BN_HUNDRED),
  ]);

  await signTx(api, batchAllEvent, testUser.keyRingPair).then((result) => {
    const event = getEventResultFromMangataTx(result);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(event.data).toContain("CallFiltered");
  });

  const batchAllPaymentInfo = await batchAllEvent.paymentInfo(
    testUser.keyRingPair,
  );

  expect(batchAllPaymentInfo.partialFee).bnGt(BN_ZERO);
});
