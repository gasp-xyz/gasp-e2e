/*
 *
 * @group sequencerStaking
 */

import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { getApi, initApi } from "../../utils/api";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  filterAndStringifyFirstEvent,
  getProvidingSeqStakeData,
  waitSudoOperationFail,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { signTx } from "gasp-sdk";
import { stringToBN } from "../../utils/utils";

let chain: any;
let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let testUser5: User;
let stakeAmount: BN;
let sudoUser: User;

beforeAll(async () => {
  await initApi();
  await setupApi();
  stakeAmount = (await SequencerStaking.minimalStakeAmount()).addn(1000);
  sudoUser = getSudoUser();
  await SequencerStaking.removeAddedSequencers();
  //There shouldn't be any sequencer in activeSequencers
  [testUser1, testUser2, testUser3, testUser4, testUser5] = setupUsers();
  chain = "Ethereum";

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Assets.mintNative(testUser5),
  );
  testUser1.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(GASP_ASSET_ID);
  testUser3.addAsset(GASP_ASSET_ID);
  testUser4.addAsset(GASP_ASSET_ID);
  testUser5.addAsset(GASP_ASSET_ID);
});

it("GIVEN User provides a stake by using StakeOnly action THEN User is not a sequencer", async () => {
  const events = await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      testUser1.keyRingPair.address,
      stakeAmount,
      chain,
      false,
    ),
    sudoUser.keyRingPair,
  );
  const { isUserJoinedAsSeq, userAddress, userStakeAmount } =
    await getProvidingSeqStakeData(events);
  expect(isUserJoinedAsSeq).toBeFalse();
  expect(userAddress).toEqual(testUser1.keyRingPair.address);
  expect(userStakeAmount).bnGt(await SequencerStaking.minimalStakeAmount());
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).not.toContain(
    testUser1.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeAndJoinActiveSet action AND his stake < minimalStakeAmount THEN return error", async () => {
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      testUser2.keyRingPair.address,
      (await SequencerStaking.minimalStakeAmount()).subn(1000),
      chain,
      true,
    ),
    sudoUser.keyRingPair,
  ).then(async (events) => {
    await waitSudoOperationFail(events, ["NotEnoughSequencerStake"]);
  });
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).not.toContain(
    testUser2.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeAndJoinActiveSet action AND his stake > minimalStakeAmount THEN User is a sequencer", async () => {
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      testUser3.keyRingPair.address,
      stakeAmount,
      chain,
      true,
    ),
    sudoUser.keyRingPair,
  ).then(async (events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).toContain(
    testUser3.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeOnly action And User use rejoinActiveSequencer function THEN User is a sequencer", async () => {
  await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      testUser4.keyRingPair.address,
      stakeAmount,
      chain,
      false,
    ),
    sudoUser.keyRingPair,
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const sequencersListBefore = await SequencerStaking.activeSequencers();
  expect(sequencersListBefore.toHuman().Ethereum).not.toContain(
    testUser4.keyRingPair.address,
  );

  await signTx(
    getApi(),
    await SequencerStaking.rejoinActiveSequencers(
      chain,
      testUser4.keyRingPair.address,
    ),
    sudoUser.keyRingPair,
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const sequencersListAfter = await SequencerStaking.activeSequencers();
  expect(sequencersListAfter.toHuman().Ethereum).toContain(
    testUser4.keyRingPair.address,
  );
});

it("Happy path - A user can join and leave sequencing", async () => {
  const events = await signTx(
    getApi(),
    await SequencerStaking.provideSequencerStaking(
      testUser5.keyRingPair.address,
      stakeAmount,
      chain,
    ),
    sudoUser.keyRingPair,
  );
  const eventFiltered = filterAndStringifyFirstEvent(events, "StakeProvided");
  expect(eventFiltered.chain).toEqual(chain);
  expect(stringToBN(eventFiltered.addedStake)).bnEqual(stakeAmount);
  const { isUserJoinedAsSeq, userAddress, userStakeAmount } =
    await getProvidingSeqStakeData(events);
  expect(isUserJoinedAsSeq).toBeTrue();
  expect(userAddress).toEqual(testUser5.keyRingPair.address);
  expect(userStakeAmount).bnGt(await SequencerStaking.minimalStakeAmount());
  const sequencersBefore = await SequencerStaking.activeSequencers();
  expect(sequencersBefore.toHuman().Ethereum).toContain(
    testUser5.keyRingPair.address,
  );

  await signTx(
    getApi(),
    await SequencerStaking.leaveSequencerStaking(chain),
    testUser5.keyRingPair,
  ).then(async (events) => {
    const eventFiltered = filterAndStringifyFirstEvent(
      events,
      "SequencersRemovedFromActiveSet",
    );
    expect(eventFiltered[0]).toEqual(chain);
    expect(eventFiltered[1][0]).toEqual(testUser5.keyRingPair.address);
  });

  await signTx(
    getApi(),
    await SequencerStaking.unstake(chain),
    testUser5.keyRingPair,
  ).then(async (events) => {
    const eventFiltered = filterAndStringifyFirstEvent(events, "Unreserved");
    expect(eventFiltered.who).toEqual(testUser5.keyRingPair.address);
    expect(stringToBN(eventFiltered.amount)).bnGt(
      await SequencerStaking.minimalStakeAmount(),
    );
  });

  const sequencersAfter = await SequencerStaking.activeSequencers();
  expect(sequencersAfter.toHuman().Ethereum).not.toContain(
    testUser5.keyRingPair.address,
  );
});
