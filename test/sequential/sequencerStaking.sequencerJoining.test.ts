/*
 *
 * @group L1RolldownUpdates
 */

import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";

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
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser.keyRingPair.address,
      await SequencerStaking.provideSequencerStaking(
        stakeAmount,
        chain,
        "StakeOnly",
      ),
    ),
  );
  const eventJoining = events.filter(
    (x) => x.method === "SequencerJoinedActiveSet",
  );
  const eventReserved = events.filter((x) => x.method === "Reserved");
  expect(eventJoining[0]).toBeUndefined();
  expect(eventReserved[0].event.data[1].toHuman()).toContain(
    testUser.keyRingPair.address,
  );
  expect(eventReserved[0].event.data[2]).bnEqual(stakeAmount);
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeAndJoinActiveSet action THEN User is a sequencer", async () => {
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser.keyRingPair.address,
      await SequencerStaking.provideSequencerStaking(
        stakeAmount,
        chain,
        "StakeAndJoinActiveSet",
      ),
    ),
  );
  await waitSudoOperationSuccess(events, "SudoAsDone");
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
});

it("GIVEN User provides a stake by using StakeOnly action And User use rejoinActiveSequencer function THEN User is a sequencer", async () => {
  const provideStakingEvent = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser.keyRingPair.address,
      await SequencerStaking.provideSequencerStaking(
        stakeAmount,
        chain,
        "StakeOnly",
      ),
    ),
  );
  await waitSudoOperationSuccess(provideStakingEvent, "SudoAsDone");
  const sequencersListBefore = await SequencerStaking.activeSequencers();
  expect(sequencersListBefore.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );
  const rejoinEvent = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser.keyRingPair.address,
      await SequencerStaking.rejoinActiveSequencers(chain),
    ),
  );
  await waitSudoOperationSuccess(rejoinEvent, "SudoAsDone");
  const sequencersListAfter = await SequencerStaking.activeSequencers();
  expect(sequencersListAfter.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );
});

it("Happy path - A user can join and leave sequencing", async () => {
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser.keyRingPair.address,
      await SequencerStaking.provideSequencerStaking(
        stakeAmount,
        chain,
        "StakeAndJoinActiveSet",
      ),
    ),
  );
  const eventJoining = events.filter(
    (x) => x.method === "SequencerJoinedActiveSet",
  );
  const eventReserved = events.filter((x) => x.method === "Reserved");
  expect(eventJoining[0].event.data[1].toHuman()).toContain(
    testUser.keyRingPair.address,
  );
  expect(eventReserved[0].event.data[2]).bnGt(
    await SequencerStaking.minimalStakeAmount(),
  );
  const sequencersBefore = await SequencerStaking.activeSequencers();
  expect(sequencersBefore.toHuman().Ethereum).toContain(
    testUser.keyRingPair.address,
  );

  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser.keyRingPair.address,
      await SequencerStaking.leaveSequencerStaking(chain),
    ),
  ).then(async (events) => {
    const eventFiltered = events.filter(
      (x) => x.method === "SequencersRemovedFromActiveSet",
    );
    expect(eventFiltered[0].event.data[0].toHuman()).toContain(chain);
    expect(eventFiltered[0].event.data[1].toHuman()).toContain(
      testUser.keyRingPair.address,
    );
  });

  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser.keyRingPair.address,
      await SequencerStaking.unstake(chain),
    ),
  ).then(async (events) => {
    const eventFiltered = events.filter((x) => x.method === "Unreserved");
    expect(eventFiltered[0].event.data[2]).bnGt(
      await SequencerStaking.minimalStakeAmount(),
    );
  });

  const sequencersAfter = await SequencerStaking.activeSequencers();
  expect(sequencersAfter.toHuman().Ethereum).not.toContain(
    testUser.keyRingPair.address,
  );
});
