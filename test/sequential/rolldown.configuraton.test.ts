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

let testUser: User;
let chain: any;

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  getApi();
  chain = "Ethereum";
});

beforeEach(async () => {
  await SequencerStaking.removeAddedSequencers();
  [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
});

test("Dispute periods can be changed for sequencers, and new values are considered for upcoming updates", async () => {
  const api = getApi();
  await SequencerStaking.setupASequencer(testUser, chain);

  const oldPeriodLength = (
    await Rolldown.disputePeriodLength(chain)
  ).toNumber();
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
  expect(disputeLength1).toEqual(oldPeriodLength);
  const newPeriodLength = oldPeriodLength + 5;

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

  await Sudo.asSudoFinalized(
    Sudo.sudo(Rolldown.setDisputePeriod(chain, oldPeriodLength)),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});
