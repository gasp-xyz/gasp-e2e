/*
 *
 * @group sequencerRewards
 */

import { BN_MILLION, BN_ZERO } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import {
  expectMGAExtrinsicSuDidFailed,
  expectMGAExtrinsicSuDidSuccess,
  filterAndStringifyFirstEvent,
  getSessionIndex,
} from "../../utils/eventListeners";
import {
  createAnUpdate,
  L2Update,
  Rolldown,
} from "../../utils/rollDown/Rolldown";
import {
  leaveSequencing,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  stringToBN,
  waitBlockNumber,
  waitNewStakingRound,
} from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { ApiPromise } from "@polkadot/api";

let testUser: User;
let api: ApiPromise;
const chainEth = "Ethereum";
const chainArb = "Arbitrum";

async function getUpdate(txIndex: number, userAddress: string, chain: string) {
  const update = new L2Update(api)
    .withDeposit(txIndex, userAddress, userAddress, BN_MILLION)
    .on(chain)
    .buildUnsafe();

  return update;
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  setupUsers();
});

beforeEach(async () => {
  await setupApi();
  [testUser] = setupUsers();
  testUser.addAsset(GASP_ASSET_ID);
  api = getApi();
  await SequencerStaking.removeAllSequencers();
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  const stakeAndJoinExtrinsic = await SequencerStaking.provideSequencerStaking(
    minToBeSequencer.addn(1000),
    chainEth,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Sudo.sudoAs(testUser, stakeAndJoinExtrinsic),
  );
  testUser.addAsset(GASP_ASSET_ID);
});

it("Sequencer budget is set when initializing issuance config", async () => {
  const events = await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
  );
  const filteredEvent = await filterAndStringifyFirstEvent(
    events,
    "IssuanceConfigInitialized",
  );
  expect(filteredEvent[0].sequencersSplit).not.toBeEmpty();
});

it("Sequencers get paid on every session BUT only when they submit valid updates ( Succeeded extrinsics )", async () => {
  await Sudo.batchAsSudoFinalized(Assets.FinalizeTge(), Assets.initIssuance());
  const disputePeriodLength = (await Rolldown.disputePeriodLength()).toNumber();
  const { reqId } = await createAnUpdate(testUser, chainEth);
  const rewardsSessionNumber = await getSessionIndex();
  const registrationBlock = reqId + 1;
  await waitBlockNumber(registrationBlock.toString(), disputePeriodLength * 2);
  await waitNewStakingRound();
  //We receive rewards data only two rounds after the update
  const sessionIndex = await getSessionIndex();
  if (sessionIndex <= rewardsSessionNumber + 1) {
    await waitNewStakingRound();
  }
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  const rewardInfo1 = await SequencerStaking.roundSequencerRewardInfo(
    testUser.keyRingPair.address,
    rewardsSessionNumber,
  );
  const rewardInfo2 = await SequencerStaking.roundSequencerRewardInfo(
    testUser.keyRingPair.address,
    rewardsSessionNumber + 1,
  );
  const payoutEvent = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      testUser,
      SequencerStaking.payoutRewards(testUser.keyRingPair.address, 2),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(payoutEvent);
  const filteredEvent = await filterAndStringifyFirstEvent(
    payoutEvent,
    "Rewarded",
  );
  const sequencerRewards = stringToBN(filteredEvent[2]);
  await testUser.refreshAmounts(AssetWallet.AFTER);
  const diff = testUser.getWalletDifferences()[0].diff.free;
  expect(filteredEvent[0]).toEqual(rewardsSessionNumber.toString());
  expect(diff).bnEqual(sequencerRewards);
  expect(rewardInfo1).bnEqual(sequencerRewards);
  expect(rewardInfo2).bnEqual(BN_ZERO);
});

it("When a sequencer brings an update It will get some points", async () => {
  await Sudo.batchAsSudoFinalized(Assets.FinalizeTge(), Assets.initIssuance());
  await createAnUpdate(testUser, chainEth);
  const rewardsSessionNumber = await getSessionIndex();
  const pointsValue = await SequencerStaking.points(rewardsSessionNumber);
  const userAwardedPts = await SequencerStaking.awardedPts(
    rewardsSessionNumber,
    testUser.keyRingPair.address,
  );
  expect(userAwardedPts).bnEqual(pointsValue);
});

it("When session ends, tokens will be distributed according the points obtained", async () => {
  await Sudo.batchAsSudoFinalized(Assets.FinalizeTge(), Assets.initIssuance());
  const [testUser2, testUser3] = setupUsers();
  testUser3.addAsset(GASP_ASSET_ID);
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  const stakeAndJoinExtrinsicEth =
    await SequencerStaking.provideSequencerStaking(
      minToBeSequencer.addn(1000),
      chainEth,
    );
  const stakeAndJoinExtrinsicArb =
    await SequencerStaking.provideSequencerStaking(
      minToBeSequencer.addn(1000),
      chainArb,
    );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Sudo.sudoAs(testUser2, stakeAndJoinExtrinsicEth),
    Sudo.sudoAs(testUser3, stakeAndJoinExtrinsicArb),
  );
  const txIndexEth = await Rolldown.lastProcessedRequestOnL2(chainEth);
  const txIndexArb = await Rolldown.lastProcessedRequestOnL2(chainArb);
  await Rolldown.waitForReadRights(testUser3.keyRingPair.address, 50, chainArb);
  await waitNewStakingRound();
  const selectedSequencerEth = (
    await getApi().query.sequencerStaking.selectedSequencer()
  ).toHuman().Ethereum;
  let ethUser1: User;
  let ethUser2: User;
  if (selectedSequencerEth!.toString() === testUser.keyRingPair.address) {
    ethUser1 = testUser;
    ethUser2 = testUser2;
  } else {
    ethUser1 = testUser2;
    ethUser2 = testUser;
  }
  ethUser1.addAsset(GASP_ASSET_ID);
  ethUser2.addAsset(GASP_ASSET_ID);
  const updateEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      ethUser1.keyRingPair.address,
      await getUpdate(txIndexEth, ethUser1.keyRingPair.address, chainEth),
    ),
    Sudo.sudoAsWithAddressString(
      testUser3.keyRingPair.address,
      await getUpdate(txIndexArb, testUser3.keyRingPair.address, chainArb),
    ),
  );
  const waitingBlockNumber =
    (await Rolldown.getRequestIdFromEvents(updateEvents)) + 1;
  await waitBlockNumber(waitingBlockNumber.toString(), 50);
  const rewardsSessionNumber = await getSessionIndex();
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser3.keyRingPair.address,
      await getUpdate(txIndexArb + 1, testUser3.keyRingPair.address, chainArb),
    ),
  );
  const pointsValue = await SequencerStaking.points(rewardsSessionNumber);
  const user1AwardedPts = await SequencerStaking.awardedPts(
    rewardsSessionNumber,
    ethUser1.keyRingPair.address,
  );
  const user2AwardedPts = await SequencerStaking.awardedPts(
    rewardsSessionNumber,
    ethUser2.keyRingPair.address,
  );
  const user3AwardedPts = await SequencerStaking.awardedPts(
    rewardsSessionNumber,
    testUser3.keyRingPair.address,
  );
  expect(user1AwardedPts).bnEqual(pointsValue.divn(3));
  expect(user2AwardedPts).bnEqual(BN_ZERO);
  expect(user3AwardedPts).bnEqual(pointsValue.divn(3).muln(2));
  let sessionIndex = await getSessionIndex();
  while (sessionIndex <= rewardsSessionNumber + 1) {
    await waitNewStakingRound();
    sessionIndex = await getSessionIndex();
  }
  await ethUser1.refreshAmounts(AssetWallet.BEFORE);
  await ethUser2.refreshAmounts(AssetWallet.BEFORE);
  await testUser3.refreshAmounts(AssetWallet.BEFORE);
  const payoutEvent1 = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      ethUser1,
      SequencerStaking.payoutRewards(ethUser1.keyRingPair.address, 2),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(payoutEvent1);
  const filteredEvent1 = await filterAndStringifyFirstEvent(
    payoutEvent1,
    "Rewarded",
  );
  const sequencerRewards1 = stringToBN(filteredEvent1[2]);
  const payoutEvent2 = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      ethUser2,
      SequencerStaking.payoutRewards(ethUser2.keyRingPair.address, 2),
    ),
  );
  expectMGAExtrinsicSuDidFailed(payoutEvent2);
  const payoutEvent3 = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      testUser3,
      SequencerStaking.payoutRewards(testUser3.keyRingPair.address, 2),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(payoutEvent3);
  const filteredEvent3 = await filterAndStringifyFirstEvent(
    payoutEvent3,
    "Rewarded",
  );
  const sequencerRewards3 = stringToBN(filteredEvent3[2]);
  await ethUser1.refreshAmounts(AssetWallet.AFTER);
  await ethUser2.refreshAmounts(AssetWallet.AFTER);
  await testUser3.refreshAmounts(AssetWallet.AFTER);
  const diff1 = ethUser1.getWalletDifferences()[0].diff.free;
  const diff2 = ethUser2.getWalletDifferences();
  const diff3 = testUser3.getWalletDifferences()[0].diff.free;
  expect(diff3).bnGt(diff1);
  expect(diff2).toBeEmpty();
  expect(diff1).bnEqual(sequencerRewards1);
  expect(diff3).bnEqual(sequencerRewards3);
  expect(sequencerRewards1).bnEqual(
    sequencerRewards3.divn(2) || sequencerRewards3.divn(2).addn(1),
  );
});

it("Regardless joining , slash, join or leaving sequencer set, Sequencer will be paid if points", async () => {
  await Sudo.batchAsSudoFinalized(Assets.FinalizeTge(), Assets.initIssuance());
  await createAnUpdate(testUser, chainEth);
  const rewardsSessionNumber = await getSessionIndex();
  await leaveSequencing(testUser.keyRingPair.address);
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );
  let sessionIndex = await getSessionIndex();
  while (sessionIndex <= rewardsSessionNumber + 1) {
    await waitNewStakingRound();
    sessionIndex = await getSessionIndex();
  }
  const payoutEvent = await Sudo.asSudoFinalized(
    Sudo.sudoAs(
      testUser,
      SequencerStaking.payoutRewards(testUser.keyRingPair.address, 2),
    ),
  );
  expectMGAExtrinsicSuDidSuccess(payoutEvent);
  const filteredEvent = await filterAndStringifyFirstEvent(
    payoutEvent,
    "Rewarded",
  );
  const sequencerRewards = stringToBN(filteredEvent[2]);
  expect(sequencerRewards).bnGt(BN_ZERO);
});
