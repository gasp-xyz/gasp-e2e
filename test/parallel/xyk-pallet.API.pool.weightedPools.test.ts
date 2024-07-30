/*
 *
 * @group api
 * @group rewardsV2Parallel
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_HUNDRED, BN_ZERO, signTx } from "gasp-sdk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  claimRewards,
  getLiquidityAssetId,
  mintLiquidity,
  promotePool,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  stringToBN,
  waitForNBlocks,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN } from "@polkadot/util";
import "jest-extended";
import { ProofOfStake } from "../../utils/ProofOfStake";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);

process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let token1: BN;
let liqId: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  await setupApi();
});

beforeEach(async () => {
  [testUser1] = setupUsers();
  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      ProofOfStake.activateLiquidity(liqId, Assets.DEFAULT_AMOUNT.divn(2)),
    ),
  );
});

test("Check that we can get the list of promoted pools with proofOfStake.promotedPoolRewards data storage", async () => {
  const poolWeight = (await getPromotedPoolInfo(liqId)).weight;
  expect(poolWeight).bnEqual(new BN(20));
  const sdkPools = await mangata?.query.getPools();
  expect(
    sdkPools!.filter(
      (x) => x.liquidityTokenId === liqId.toString() && x.isPromoted,
    ),
  ).toHaveLength(1);
});

test("Validate that weight can be modified by using updatePoolPromotion AND only sudo can update weights", async () => {
  const api = getApi();

  const poolWeightBefore = (await getPromotedPoolInfo(liqId)).weight;

  await signTx(
    api,
    api.tx.proofOfStake.updatePoolPromotion(
      liqId,
      poolWeightBefore.div(new BN(2)),
    ),
    testUser1.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("UnknownError");
  });

  await promotePool(
    sudo.keyRingPair,
    liqId,
    poolWeightBefore.div(new BN(2)).toNumber(),
  );

  const poolWeightAfter = (await getPromotedPoolInfo(liqId)).weight;

  expect(poolWeightAfter).bnEqual(poolWeightBefore.div(new BN(2)));
});

test("Testing that the sum of the weights can be greater than 100", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  const liqId2 = await getLiquidityAssetId(GASP_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId2.toNumber(), 100));

  const poolWeightLiq1 = (await getPromotedPoolInfo(liqId)).weight;

  const poolWeightLiq2 = (await getPromotedPoolInfo(liqId2)).weight;

  const sumPoolsWeights = poolWeightLiq1.add(poolWeightLiq2);

  expect(sumPoolsWeights).bnGt(BN_HUNDRED);
});

test("GIVEN a pool WHEN it has configured with 0 THEN no new issuance will be reserved", async () => {
  const [testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
    ),
  );

  testUser2.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(token1);

  await waitForRewards(testUser1, liqId);

  await promotePool(sudo.keyRingPair, liqId, 0);

  await claimRewards(testUser1, liqId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  //Validate that another user tries minting into the disabled pool.
  await mintLiquidity(
    testUser2.keyRingPair,
    GASP_ASSET_ID,
    token1,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser2.refreshAmounts(AssetWallet.AFTER);

  expect(testUser2.getAsset(GASP_ASSET_ID)!.amountAfter.free!).bnGt(BN_ZERO);
  expect(testUser2.getAsset(GASP_ASSET_ID)!.amountAfter.reserved!).bnEqual(
    BN_ZERO,
  );
});

test("GIVEN a deactivated pool WHEN its configured with more weight, THEN rewards are now active, new users can get portion of those rewards AND issuance grows", async () => {
  await waitForRewards(testUser1, liqId);

  const poolRewardsBefore = (await getPromotedPoolInfo(liqId)).rewards;

  await promotePool(sudo.keyRingPair, liqId, 0);

  const [testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
  );

  await promotePool(sudo.keyRingPair, liqId, 20);

  await mintLiquidity(
    testUser2.keyRingPair,
    GASP_ASSET_ID,
    token1,
    defaultCurrencyValue,
  );

  await waitForRewards(testUser2, liqId);

  const poolRewardsAfter = (await getPromotedPoolInfo(liqId)).rewards;

  expect(poolRewardsBefore).bnGt(BN_ZERO);
  expect(poolRewardsAfter).bnGt(poolRewardsBefore);
});

test("GIVEN an activated pool WHEN pool was deactivated THEN check that the user will still get some rewards from the curve, and storage is updated", async () => {
  const api = getApi();
  await waitForRewards(testUser1, liqId);
  await claimRewards(testUser1, liqId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  await waitForNBlocks(1);
  const poolInfoBefore = await getPromotedPoolInfo(liqId);
  await promotePool(sudo.keyRingPair, liqId, 0);
  //Test user1 should still have some rewards in the curve.
  await waitForRewards(testUser1, liqId);
  const poolRewards = JSON.parse(
    JSON.stringify(await api.query.proofOfStake.promotedPoolRewards()),
  );
  const poolInfoAfter = await getPromotedPoolInfo(liqId);
  const mangata = await getMangataInstance(
    getEnvironmentRequiredVars().chainUri,
  );
  const rewardsAfterDisablePool = await mangata.rpc.calculateRewardsAmount({
    address: testUser1.keyRingPair.address,
    liquidityTokenId: liqId.toString(),
  });
  expect(poolInfoBefore.weight).bnGt(BN_ZERO);
  expect(poolInfoAfter.weight).bnEqual(BN_ZERO);
  //rewards should not grow.
  expect(poolInfoAfter.rewards).bnEqual(poolInfoBefore.rewards);
  expect(poolRewards[liqId.toString()]).not.toEqual(undefined);
  expect(rewardsAfterDisablePool).bnGt(BN_ZERO);
});

afterEach(async () => {
  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 0));
});

async function getPromotedPoolInfo(tokenId: BN) {
  const api = getApi();

  const poolRewards = JSON.parse(
    JSON.stringify(await api.query.proofOfStake.promotedPoolRewards()),
  );
  return {
    weight: stringToBN(poolRewards[tokenId.toString()].weight),
    rewards: stringToBN(poolRewards[tokenId.toString()].rewards),
  };
}
