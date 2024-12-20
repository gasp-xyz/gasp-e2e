/*
 *
 * @group L1RolldownUpdates
 */

import { BN_MILLION, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import {
  ExtrinsicResult,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { getBlockNumber } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ApiPromise } from "@polkadot/api";

let testUser: User;
let chain: any;
let api: ApiPromise;
let startPeriodLength: number;

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  getApi();
  chain = "Ethereum";
  api = getApi();
  startPeriodLength = (await Rolldown.disputePeriodLength(chain)).toNumber();
});

beforeEach(async () => {
  await SequencerStaking.removeAddedSequencers();
  [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
});

test("Dispute periods can be changed for sequencers, and new values are considered for upcoming updates", async () => {
  await SequencerStaking.setupASequencer(testUser, chain);

  await Rolldown.waitForReadRights(testUser.keyRingPair.address);
  const txIndex1 = await Rolldown.lastProcessedRequestOnL2(chain);

  const updateBefore = new L2Update(api)
    .withDeposit(
      txIndex1,
      testUser.keyRingPair.address,
      testUser.keyRingPair.address,
      BN_MILLION,
    )
    .on(chain)
    .buildUnsafe();
  const eventBefore = await signTx(api, updateBefore, testUser.keyRingPair);
  const res1 = getEventResultFromMangataTx(eventBefore);
  expect(res1.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const disputeStartBlockNumber1 = await getBlockNumber();
  const disputeEndBlockNumber1 = Rolldown.getDisputeEndBlockNumber(eventBefore);
  const disputeLength1 = disputeEndBlockNumber1 - disputeStartBlockNumber1;
  expect(disputeLength1).toEqual(startPeriodLength);
  const newPeriodLength = startPeriodLength + 5;

  await Sudo.asSudoFinalized(
    Sudo.sudo(Rolldown.setDisputePeriod(chain, newPeriodLength)),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });

  await Rolldown.waitForReadRights(testUser.keyRingPair.address);
  const txIndex2 = await Rolldown.lastProcessedRequestOnL2(chain);

  const updateAfter = new L2Update(api)
    .withDeposit(
      txIndex2,
      testUser.keyRingPair.address,
      testUser.keyRingPair.address,
      BN_MILLION,
    )
    .on(chain)
    .buildUnsafe();
  const eventAfter = await signTx(api, updateAfter, testUser.keyRingPair);
  const res2 = getEventResultFromMangataTx(eventAfter);
  expect(res2.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const disputeStartBlockNumber2 = await getBlockNumber();
  const disputeEndBlockNumber2 = Rolldown.getDisputeEndBlockNumber(eventAfter);
  const disputeLength2 = disputeEndBlockNumber2 - disputeStartBlockNumber2;
  expect(disputeLength2).toEqual(newPeriodLength);
});

test("GIVEN try to setup a sequencer with non-sudo call THEN fail returned", async () => {
  await signTx(
    api,
    api.tx.sequencerStaking.provideSequencerStake(
      chain,
      await SequencerStaking.minimalStakeAmount(),
      null,
      "StakeAndJoinActiveSet",
      //@ts-ignore
      testUser.keyRingPair.address,
    ),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("UnknownError");
  });

  const activeSequencers = (
    await SequencerStaking.activeSequencers()
  ).toHuman();

  expect(activeSequencers.Ethereum).not.toContain(testUser.keyRingPair.address);
});

test("GIVEN try to leave the sequencer with non-sudo call THEN the extrinsic completes successfully", async () => {
  let activeSequencers: any;

  await SequencerStaking.setupASequencer(testUser, chain);

  activeSequencers = (await SequencerStaking.activeSequencers()).toHuman();

  expect(activeSequencers.Ethereum).toContain(testUser.keyRingPair.address);

  await signTx(
    api,
    api.tx.sequencerStaking.leaveActiveSequencers(chain),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  activeSequencers = (await SequencerStaking.activeSequencers()).toHuman();

  expect(activeSequencers.Ethereum).not.toContain(testUser.keyRingPair.address);
});

afterAll(async () => {
  await Sudo.asSudoFinalized(
    Sudo.sudo(Rolldown.setDisputePeriod(chain, startPeriodLength)),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});
