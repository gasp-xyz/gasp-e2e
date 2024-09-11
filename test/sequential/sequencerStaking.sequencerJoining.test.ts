/*
 *
 * @group L1RolldownUpdates
 */

import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  filterZeroEventData,
  getProvidingSeqStakeData,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { signTx } from "gasp-sdk";

let chain: any;
let testUser: User;
let stakeAmount: BN;

beforeAll(async () => {
  await initApi();
  await setupApi();
  stakeAmount = (await SequencerStaking.minimalStakeAmount()).addn(1000);
});

beforeEach(async () => {
  //There shouldn't be any sequencer in activeSequencers
  [testUser] = setupUsers();
  chain = "Ethereum";
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
  testUser.addAsset(GASP_ASSET_ID);
});

it("GIVEN User provides a stake by using StakeOnly action THEN User is not a sequencer", async () => {
  const events = await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(stakeAmount, chain, false),
    testUser.keyRingPair,
  );
  const { isUserJoinedAsSeq, userAddress,  userStakeAmount } = await getProvidingSeqStakeData(events);
  expect(isUserJoinedAsSeq).toBeFalse();
  expect(userAddress).toEqual(
    testUser.keyRingPair.address,
  );
  expect(userStakeAmount).bnGt(await SequencerStaking.minimalStakeAmount());
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeAndJoinActiveSet action AND his stake < minimalStakeAmount THEN return error", async () => {
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      (await SequencerStaking.minimalStakeAmount()).subn(1000),
      chain,
      true,
    ),
    testUser.keyRingPair,
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NotEnoughSequencerStake");
  });
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeAndJoinActiveSet action AND his stake > minimalStakeAmount THEN User is a sequencer", async () => {
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(stakeAmount, chain, true),
    testUser.keyRingPair,
  ).then(async (events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeOnly action And User use rejoinActiveSequencer function THEN User is a sequencer", async () => {
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(stakeAmount, chain, false),
    testUser.keyRingPair,
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const sequencersListBefore = await SequencerStaking.activeSequencers();
  expect(sequencersListBefore.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );

  await signTx(
    getApi(),
    await SequencerStaking.rejoinActiveSequencers(chain),
    testUser.keyRingPair,
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const sequencersListAfter = await SequencerStaking.activeSequencers();
  expect(sequencersListAfter.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
});

it("Happy path - A user can join and leave sequencing", async () => {
  const events = await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(stakeAmount, chain),
    testUser.keyRingPair,
  );
  const eventFiltered = filterZeroEventData(events, "StakeProvided");
  expect(eventFiltered.chain).toEqual(chain);
  expect(new BN(eventFiltered.addedStake.replaceAll(",",""))).bnEqual(
    stakeAmount
  );
  const { isUserJoinedAsSeq, userAddress,  userStakeAmount } = await getProvidingSeqStakeData(events);
  expect(isUserJoinedAsSeq).toBeTrue();
  expect(userAddress).toEqual(
    testUser.keyRingPair.address,
  );
  expect(userStakeAmount).bnGt(await SequencerStaking.minimalStakeAmount());
  const sequencersBefore = await SequencerStaking.activeSequencers();
  expect(sequencersBefore.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );

  await signTx(
    getApi(),
    await SequencerStaking.leaveSequencerStaking(chain),
    testUser.keyRingPair,
  ).then(async (events) => {
    const eventFiltered = filterZeroEventData(events, "SequencersRemovedFromActiveSet");
    expect(eventFiltered[0]).toEqual(chain);
    expect(eventFiltered[1][0]).toEqual(
      testUser.keyRingPair.address,
    );
  });

  await signTx(
    getApi(),
    await SequencerStaking.unstake(chain),
    testUser.keyRingPair,
  ).then(async (events) => {
    const eventFiltered = filterZeroEventData(events, "Unreserved");
    expect(eventFiltered.who).toEqual( testUser.keyRingPair.address);
    expect(new BN(eventFiltered.amount.replaceAll(",",""))).bnGt(
      await SequencerStaking.minimalStakeAmount(),
    );
  });

  const sequencersAfter = await SequencerStaking.activeSequencers();
  expect(sequencersAfter.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );
});
