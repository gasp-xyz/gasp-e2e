import { BN_HUNDRED_BILLIONS, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { filterZeroEventData } from "../../utils/eventListeners";
import { createAnUpdate, Rolldown } from "../../utils/rollDown/Rolldown";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  stringToBN,
  waitBlockNumber,
  waitNewStakingRound,
} from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { GASP_ASSET_ID } from "../../utils/Constants";

let sudo: User;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  sudo = getSudoUser();
  setupUsers();
});

it("Sequencer budget is set when initializing issuance config", async () => {
  const events = await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
  );
  const filteredEvent = await filterZeroEventData(
    events,
    "IssuanceConfigInitialized",
  );
  expect(filteredEvent[0].sequencersSplit).not.toBeEmpty();
});

it("Sequencers get paid on every session BUT only when they submit valid updates ( Suceeded extrinsics )", async () => {
  await Sudo.batchAsSudoFinalized(Assets.FinalizeTge(), Assets.initIssuance());
  const [testUser] = setupUsers();
  testUser.addAsset(GASP_ASSET_ID);
  const api = getApi();
  const chain = "Ethereum";
  await SequencerStaking.removeAddedSequencers();
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  const stakeAndJoinExtrinsic = await SequencerStaking.provideSequencerStaking(
    minToBeSequencer.addn(1000),
    chain,
  );
  const disputePeriodLength = (await Rolldown.disputePeriodLength()).toNumber();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Sudo.sudoAs(testUser, stakeAndJoinExtrinsic),
  );
  const { reqId } = await createAnUpdate(testUser, chain);
  const registrationBlock = reqId + 1;
  await waitBlockNumber(registrationBlock.toString(), disputePeriodLength * 2);
  const rewardsSessionNumber = (
    await api.query.session.currentIndex()
  ).toNumber();
  await waitNewStakingRound();
  await waitNewStakingRound();
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  const rewardInfo1 = await SequencerStaking.roundSequencerRewardInfo(
    testUser.keyRingPair.address,
    rewardsSessionNumber,
  );
  const rewardInfo2 = await SequencerStaking.roundSequencerRewardInfo(
    testUser.keyRingPair.address,
    rewardsSessionNumber + 1,
  );
  expect(rewardInfo1).bnEqual(BN_HUNDRED_BILLIONS);
  expect(rewardInfo2).bnEqual(BN_HUNDRED_BILLIONS);
  const payoutEvent = await signTx(
    api,
    SequencerStaking.payoutRewards(testUser.keyRingPair.address, 2),
    sudo.keyRingPair,
  );
  const filteredEvent = await filterZeroEventData(payoutEvent, "Rewarded");
  const sequencerRewards = stringToBN(filteredEvent[2]);
  expect(filteredEvent[0]).toEqual(rewardsSessionNumber.toString());
  await testUser.refreshAmounts(AssetWallet.AFTER);
  const diff = testUser.getWalletDifferences()[0].diff.free;
  expect(diff).bnEqual(sequencerRewards);
});
