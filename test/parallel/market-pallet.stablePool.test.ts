/*
 *
 * @group parallel
 */

import { jest } from "@jest/globals";
import { ApiPromise } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN } from "ethereumjs-util";
import { Market } from "../../utils/market";
import {
  BN_HUNDRED,
  BN_HUNDRED_THOUSAND,
  BN_MILLION,
  BN_THOUSAND,
  BN_ZERO,
  signTx,
} from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import {
  activateLiquidity,
  getPoolIdFromEvent,
  getRewardsInfo,
} from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;
let firstCurrency: BN;
let secondCurrency: BN;
let api: ApiPromise;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  api = getApi();
  sudo = getSudoUser();
  await setupApi();
  setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(sudo),
  );
});

beforeEach(async () => {
  [testUser] = setupUsers();
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser,
    [BN_MILLION, BN_MILLION],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
});

test("Happy path - create stable pool", async () => {
  const event = await signTx(
    api,
    Market.createPool(
      firstCurrency,
      BN_HUNDRED_THOUSAND,
      secondCurrency,
      BN_THOUSAND,
      "StableSwap",
    ),
    testUser.keyRingPair,
  );
  const result = getEventResultFromMangataTx(event);
  expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const poolId = await getPoolIdFromEvent(event);
  expect(poolId).bnGt(BN_ZERO);
});

// Goncer: Investigated & Reported.
test("Happy path - Swap tokens in stableSwap pool", async () => {
  const event = await signTx(
    api,
    Market.createPool(
      firstCurrency,
      BN_HUNDRED_THOUSAND,
      secondCurrency,
      BN_THOUSAND,
      "StableSwap",
    ),
    testUser.keyRingPair,
  );
  testUser.addAsset(firstCurrency);
  testUser.addAsset(secondCurrency);
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  const poolId = await getPoolIdFromEvent(event);
  await signTx(
    api,
    await Market.buyAsset(poolId, firstCurrency, secondCurrency, BN_HUNDRED),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  await testUser.refreshAmounts(AssetWallet.AFTER);
  const firstCurrencyDiff = testUser
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(
      testUser.getAsset(firstCurrency)?.amountAfter.free!,
    );
  const secondCurrencyDiff = testUser
    .getAsset(secondCurrency)
    ?.amountAfter.free!.sub(
      testUser.getAsset(secondCurrency)?.amountBefore.free!,
    );
  expect(firstCurrencyDiff).bnGt(BN_ZERO);
  expect(secondCurrencyDiff).bnEqual(BN_HUNDRED);
});

test("Happy path - Mint stableSwap pool liquidity token", async () => {
  const event = await signTx(
    api,
    Market.createPool(
      firstCurrency,
      BN_HUNDRED_THOUSAND,
      secondCurrency,
      BN_THOUSAND,
      "StableSwap",
    ),
    testUser.keyRingPair,
  );
  const poolId = await getPoolIdFromEvent(event);
  testUser.addAsset(firstCurrency);
  testUser.addAsset(secondCurrency);
  testUser.addAsset(poolId);
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    api,
    Market.mintLiquidity(poolId, firstCurrency, BN_THOUSAND),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  await testUser.refreshAmounts(AssetWallet.AFTER);
  const firstCurrencyDiff = testUser
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(
      testUser.getAsset(firstCurrency)?.amountAfter.free!,
    );
  const liqTokenDiff = testUser
    .getAsset(poolId)
    ?.amountAfter.free!.sub(testUser.getAsset(poolId)?.amountBefore.free!);
  expect(firstCurrencyDiff).bnEqual(BN_THOUSAND);
  expect(liqTokenDiff).bnGt(BN_ZERO);
});

test("Happy path - Burn stableSwap pool liquidity token", async () => {
  const event = await signTx(
    api,
    Market.createPool(
      firstCurrency,
      BN_HUNDRED_THOUSAND,
      secondCurrency,
      BN_THOUSAND,
      "StableSwap",
    ),
    testUser.keyRingPair,
  );
  const poolId = await getPoolIdFromEvent(event);
  testUser.addAsset(firstCurrency);
  testUser.addAsset(secondCurrency);
  testUser.addAsset(poolId);
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    api,
    Market.burnLiquidity(poolId, BN_THOUSAND),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  await testUser.refreshAmounts(AssetWallet.AFTER);
  const firstCurrencyDiff = testUser
    .getAsset(firstCurrency)
    ?.amountAfter.free!.sub(
      testUser.getAsset(firstCurrency)?.amountBefore.free!,
    );
  const liqTokenDiff = testUser
    .getAsset(poolId)
    ?.amountBefore.free!.sub(testUser.getAsset(poolId)?.amountAfter.free!);
  expect(firstCurrencyDiff).bnGt(BN_ZERO);
  expect(liqTokenDiff).bnEqual(BN_THOUSAND);
});

test("Happy path - Activate rewards for stableSwap pool", async () => {
  const event = await signTx(
    api,
    Market.createPool(
      firstCurrency,
      BN_HUNDRED_THOUSAND,
      secondCurrency,
      BN_THOUSAND,
      "StableSwap",
    ),
    testUser.keyRingPair,
  );
  const poolId = await getPoolIdFromEvent(event);
  await Sudo.batchAsSudoFinalized(Assets.promotePool(poolId.toNumber(), 20));
  await activateLiquidity(testUser.keyRingPair, poolId, BN_HUNDRED_THOUSAND);
  const rewards = await getRewardsInfo(testUser.keyRingPair.address, poolId);
  expect(rewards.activatedAmount).bnEqual(BN_HUNDRED_THOUSAND);
});
