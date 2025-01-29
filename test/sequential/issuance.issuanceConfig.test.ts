/*
 *
 * @group issuanceConfig
 */

import { jest } from "@jest/globals";
import { BN } from "ethereumjs-util/dist/externals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  expectMGAExtrinsicSuDidSuccess,
  filterAndStringifyFirstEvent,
  getSessionIndex,
  waitForRewards,
} from "../../utils/eventListeners";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  activateLiquidity,
  claimRewards,
  deactivateLiquidity,
  getLiquidityAssetId,
  getRewardsInfo,
} from "../../utils/tx";
import { User } from "../../utils/User";
import { Market } from "../../utils/market";
import { BN_ZERO } from "gasp-sdk";
import { Issuance } from "../../utils/Issuance";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { createAnUpdate, Rolldown } from "../../utils/rollDown/Rolldown";
import {
  stringToBN,
  waitBlockNumber,
  waitForSessionN,
  waitUntilUserCollatorRewarded,
} from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let sudo: User;
let token1: BN;
let liqId: BN;
let miningSplitBeginning: number;
let stakingSplitBeginning: number;
let sequencersSplitBeginning: number;
const poolValue = new BN(2500000);

async function getRewardsAmount(event: any) {
  const filterData = JSON.parse(JSON.stringify(event))[0].event.data;
  //const rewardAmountString = filterData[2].replace("0x", "");
  return stringToBN(filterData[2]);
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  await setupApi();
  setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(
      sudo,
      (await SequencerStaking.minimalStakeAmount()).muln(100),
    ),
  );
});

beforeEach(async () => {
  //remember the initial system parameters for recovery after tests
  const issuanceConfigBefore = await Issuance.getIssuanceConfig();
  miningSplitBeginning = issuanceConfigBefore.liquidityMiningSplit / 10000000;
  stakingSplitBeginning = issuanceConfigBefore.stakingSplit / 10000000;
  sequencersSplitBeginning = issuanceConfigBefore.sequencersSplit / 10000000;
  //we use integers in the tests to make things simpler
  await Sudo.batchAsSudoFinalized(await Issuance.setIssuanceConfig(40, 20, 40));
});

test("Compare amount of mining rewards for 2 difference configuration", async () => {
  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [poolValue.muln(2)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      Market.createPool(GASP_ASSET_ID, poolValue, token1, poolValue),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));

  const [testUser1, testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(liqId, testUser1, poolValue),
    Assets.mintNative(testUser1),
    Assets.mintToken(liqId, testUser2, poolValue),
    Assets.mintNative(testUser2),
  );

  testUser1.addAssets([GASP_ASSET_ID, liqId]);

  await activateLiquidity(testUser1.keyRingPair, liqId, poolValue.divn(10));

  await waitForRewards(testUser1, liqId);

  const userTokenBeforeClaiming1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId,
  );

  await claimRewards(testUser1, liqId);

  const userTokenAfterClaiming1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId,
  );

  await deactivateLiquidity(testUser1.keyRingPair, liqId, poolValue.divn(10));

  expect(userTokenBeforeClaiming1.activatedAmount).bnGt(BN_ZERO);
  expect(userTokenBeforeClaiming1.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(userTokenAfterClaiming1.rewardsAlreadyClaimed).bnGt(BN_ZERO);

  await Sudo.batchAsSudoFinalized(await Issuance.setIssuanceConfig(20, 40, 40));
  await waitForSessionN((await getSessionIndex()) + 1);

  testUser2.addAssets([GASP_ASSET_ID, liqId]);

  await activateLiquidity(testUser2.keyRingPair, liqId, poolValue.divn(10));

  await waitForRewards(testUser2, liqId);

  const userTokenBeforeClaiming2 = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqId,
  );

  await claimRewards(testUser2, liqId);

  const userTokenAfterClaiming2 = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqId,
  );

  await deactivateLiquidity(testUser2.keyRingPair, liqId, poolValue.divn(10));

  expect(userTokenBeforeClaiming2.activatedAmount).bnGt(BN_ZERO);
  expect(userTokenBeforeClaiming2.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(userTokenAfterClaiming2.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(userTokenAfterClaiming2.rewardsAlreadyClaimed).bnEqual(
    userTokenAfterClaiming1.rewardsAlreadyClaimed.divn(2),
  );
});

test("Compare amount of sequencer rewards for 2 difference configuration", async () => {
  const [testUser] = setupUsers();
  const disputePeriodLength = (
    await Rolldown.disputePeriodLength("Ethereum")
  ).toNumber();

  await SequencerStaking.removeAddedSequencers();
  await SequencerStaking.setupASequencer(testUser, "Ethereum");
  testUser.addAsset(GASP_ASSET_ID);

  const { disputeEndBlockNumber: disputeEndBlockNumber1 } =
    await createAnUpdate(testUser, "Ethereum");
  const rewardsSessionNumber1 = await getSessionIndex();
  const registrationBlock1 = disputeEndBlockNumber1 + 1;
  await waitBlockNumber(registrationBlock1.toString(), disputePeriodLength * 2);
  await waitForSessionN(rewardsSessionNumber1 + 2);
  const rewardInfo1 = await SequencerStaking.roundSequencerRewardInfo(
    testUser.keyRingPair.address,
    rewardsSessionNumber1,
  );
  const payoutEvent1 = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      testUser,
      SequencerStaking.payoutRewards(testUser.keyRingPair.address, 2),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(payoutEvent1);
  const filteredEvent1 = await filterAndStringifyFirstEvent(
    payoutEvent1,
    "Rewarded",
  );
  const sequencerRewards1 = stringToBN(filteredEvent1[2]);
  expect(rewardInfo1).bnEqual(sequencerRewards1);

  await Sudo.batchAsSudoFinalized(await Issuance.setIssuanceConfig(40, 40, 20));
  await waitForSessionN((await getSessionIndex()) + 1);

  const [testUser2] = setupUsers();
  await SequencerStaking.removeAddedSequencers();
  await SequencerStaking.setupASequencer(testUser2, "Ethereum");

  const { disputeEndBlockNumber: disputeEndBlockNumber2 } =
    await createAnUpdate(testUser2, "Ethereum");
  const rewardsSessionNumber2 = await getSessionIndex();
  const registrationBlock2 = disputeEndBlockNumber2 + 1;
  await waitBlockNumber(registrationBlock2.toString(), disputePeriodLength * 2);
  await waitForSessionN(rewardsSessionNumber2 + 2);
  const rewardInfo2 = await SequencerStaking.roundSequencerRewardInfo(
    testUser2.keyRingPair.address,
    rewardsSessionNumber2,
  );
  const payoutEvent2 = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      testUser2,
      SequencerStaking.payoutRewards(testUser2.keyRingPair.address, 2),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(payoutEvent2);
  const filteredEvent2 = await filterAndStringifyFirstEvent(
    payoutEvent2,
    "Rewarded",
  );
  const sequencerRewards2 = stringToBN(filteredEvent2[2]);
  expect(rewardInfo2).bnEqual(sequencerRewards2);
  expect(sequencerRewards1).bnEqual(sequencerRewards2.muln(2));
});

test("Compare amount of parachainStaking.Rewarded for 2 difference configuration", async () => {
  await waitForSessionN((await getSessionIndex()) + 3);
  const firstEvent = await waitUntilUserCollatorRewarded(sudo);
  const rewardAmount1 = await getRewardsAmount(firstEvent);

  await Sudo.batchAsSudoFinalized(await Issuance.setIssuanceConfig(45, 10, 45));
  await waitForSessionN((await getSessionIndex()) + 3);

  const secondEvent = await waitUntilUserCollatorRewarded(sudo);
  const rewardAmount2 = await getRewardsAmount(secondEvent);

  expect(rewardAmount2).bnEqual(rewardAmount1.divn(2));
});

afterEach(async () => {
  await Sudo.batchAsSudoFinalized(
    await Issuance.setIssuanceConfig(
      miningSplitBeginning,
      stakingSplitBeginning,
      sequencersSplitBeginning,
    ),
  );
});
