/*
 *
 * @group rolldown
 */

import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import {
  createAnUpdate,
  createAnUpdateAndCancelIt,
  L2Update,
  Rolldown,
} from "../../utils/rollDown/Rolldown";
import {
  ExtrinsicResult,
  waitForAllEventsFromMatchingBlock,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { BN_MILLION, signTx } from "gasp-sdk";
import { isBadOriginError } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";
import { GASP_ASSET_ID } from "../../utils/Constants";

let api: any;
let testUser: User;
let testUserAddress: string;
const chain = "Ethereum";

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  api = getApi();
});

beforeEach(async () => {
  //TODO: Replace this by some monitoring of the active queue.
  await SequencerStaking.removeAllSequencers();
  [testUser] = setupUsers();
  testUserAddress = testUser.keyRingPair.address;
});

it("forceUpdateL2FromL1 can be called by Sudo", async () => {
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on(chain)
    .forceBuild();
  await Sudo.asSudoFinalized(Sudo.sudo(update)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});

it("forceUpdateL2FromL1 can't be called by non-sudo user", async () => {
  await SequencerStaking.setupASequencer(testUser, chain);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on(chain)
    .forceBuild();
  await signTx(api, update, testUser.keyRingPair).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    const isBadOrigin = isBadOriginError(events);
    expect(isBadOrigin).toEqual(true);
  });
});

it("Validate that forceCancelRequestsFromL1 can be called by Sudo", async () => {
  await SequencerStaking.setupASequencer(testUser, chain);
  const { reqId } = await createAnUpdate(testUser, chain);
  const cancel = await Rolldown.forceCancelRequestFromL1(chain, reqId);
  await Sudo.asSudoFinalized(Sudo.sudo(cancel)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});

it("Validate that forceCancelRequestsFromL1 can't be called by non-sudo user", async () => {
  await SequencerStaking.setupASequencer(testUser, chain);
  const { reqId } = await createAnUpdate(testUser, chain);
  const cancel = await Rolldown.forceCancelRequestFromL1(chain, reqId);
  await signTx(api, cancel, testUser.keyRingPair).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    const isBadOrigin = isBadOriginError(events);
    expect(isBadOrigin).toEqual(true);
  });
});

it("forceUpdateL2FromL1 does not wait for a dispute period", async () => {
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on(chain)
    .forceBuild();
  await Sudo.asSudoFinalized(Sudo.sudo(update)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });

  const events = await waitForAllEventsFromMatchingBlock(
    api,
    10,
    (ev) =>
      ev.method === "RequestProcessedOnL2" &&
      ev.section === "rolldown" &&
      (ev.data.toHuman() as any).requestId === txIndex.toString(),
  );

  const e = events.find(
    (ev) => ev.method === "RegisteredAsset" && ev.section === "assetRegistry",
  );
  const assetId = (e!.data.toHuman() as any).assetId
    .toString()
    .replace(",", "");
  testUser.addAsset(assetId);
  await testUser.refreshAmounts(AssetWallet.AFTER);
  expect(testUser.getAsset(assetId)?.amountAfter.free!).bnEqual(BN_MILLION);
});

it("forceCancelRequest does not need any resolution to justify the cancellation", async () => {
  testUser.addAsset(GASP_ASSET_ID);
  await SequencerStaking.setupASequencer(testUser, chain);
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  const { reqId } = await createAnUpdate(testUser, chain);
  const cancel = await Rolldown.forceCancelRequestFromL1(chain, reqId);
  await Sudo.asSudoFinalized(Sudo.sudo(cancel)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
  const cancelResolution = await Rolldown.waitCancelResolution(chain);
  expect(cancelResolution.length).toBe(0);
  await testUser.refreshAmounts(AssetWallet.AFTER);
  // TODO: We need to slash the user whose update was force-canceled without justification. Link to bug https://mangatafinance.atlassian.net/browse/MGX-1365
  // const penaltyValue = testUser
  //   .getAsset(GASP_ASSET_ID)
  //   ?.amountBefore.reserved!.sub(
  //     testUser.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
  //   );
  // expect(penaltyValue).bnEqual(await SequencerStaking.slashFineAmount());
});

describe("Seq1 do an update and seq2 cancel it", () => {
  let testUser2: User;
  let txIndex: any;
  let reqIdValue: number;
  beforeEach(async () => {
    [testUser, testUser2] = setupUsers();
    await SequencerStaking.setupASequencer(testUser, chain);
    await SequencerStaking.setupASequencer(testUser2, chain);

    txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    testUser.addAsset(GASP_ASSET_ID);
    testUser2.addAsset(GASP_ASSET_ID);
    await testUser.refreshAmounts(AssetWallet.BEFORE);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    const { reqIdCanceled } = await createAnUpdateAndCancelIt(
      testUser,
      testUser2.keyRingPair.address,
      chain,
    );
    reqIdValue = reqIdCanceled;
  });
  it("When forceUpdateL2FromL1 and Justified=false then the slashed is the canceler and sequencerStatus is updated accordingly", async () => {
    const update = new L2Update(api)
      .withCancelResolution(txIndex, reqIdValue, false)
      .on(chain)
      .forceBuild();
    await Sudo.asSudoFinalized(Sudo.sudo(update)).then(async (events) => {
      await waitSudoOperationSuccess(events);
    });
    await Rolldown.waitForL2UpdateExecuted(txIndex);
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    const activeSequencers = (
      await SequencerStaking.activeSequencers()
    ).toHuman();
    expect(activeSequencers.Ethereum).toContain(testUser.keyRingPair.address);
    expect(activeSequencers.Ethereum).not.toContain(
      testUser2.keyRingPair.address,
    );
    const testUser2PenaltyValue = testUser2
      .getAsset(GASP_ASSET_ID)
      ?.amountBefore.reserved!.sub(
        testUser2.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
      );
    expect(testUser2PenaltyValue).bnEqual(
      await SequencerStaking.slashFineAmount(),
    );
  });

  it("When forceUpdateL2FromL1 and Justified=true then the slashed is the updater and sequencerStatus is updated accordingly", async () => {
    const update = new L2Update(api)
      .withCancelResolution(txIndex, reqIdValue, true)
      .on(chain)
      .forceBuild();
    await Sudo.asSudoFinalized(Sudo.sudo(update)).then(async (events) => {
      await waitSudoOperationSuccess(events);
    });
    await Rolldown.waitForL2UpdateExecuted(txIndex);
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const activeSequencers = (
      await SequencerStaking.activeSequencers()
    ).toHuman();
    expect(activeSequencers.Ethereum).not.toContain(
      testUser.keyRingPair.address,
    );
    expect(activeSequencers.Ethereum).toContain(testUser2.keyRingPair.address);
    const testUserPenaltyValue = testUser
      .getAsset(GASP_ASSET_ID)
      ?.amountBefore.reserved!.sub(
        testUser.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
      );
    expect(testUserPenaltyValue).bnEqual(
      await SequencerStaking.slashFineAmount(),
    );
  });
});