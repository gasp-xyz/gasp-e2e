/*
 *
 * @group rolldown
 */

import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import {
  L2Update,
  Rolldown,
  createAnUpdateAndCancelIt,
} from "../../utils/rollDown/Rolldown";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import {
  expectExtrinsicFail,
  expectExtrinsicSucceed,
  waitForNBlocks,
} from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { signTx } from "gasp-sdk";

let api: any;
const chain = "Arbitrum";
let testUser1: User;
let testUser2: User;
let testUser2Address: string;
let disputePeriodLength: number;
let stakeAndJoinExtrinsic: any;

beforeAll(async () => {
  await initApi();
  await setupApi();
  api = getApi();
  disputePeriodLength = (await Rolldown.disputePeriodLength(chain)).toNumber();
});

beforeEach(async () => {
  //There shouldn't be any sequencer in activeSequencers
  [testUser1, testUser2] = setupUsers();
  await SequencerStaking.removeAllSequencers();
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  stakeAndJoinExtrinsic = await SequencerStaking.provideSequencerStaking(
    minToBeSequencer.addn(1000),
    chain,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(testUser1, stakeAndJoinExtrinsic),
    Sudo.sudoAs(testUser2, stakeAndJoinExtrinsic),
  );
  const sequencers = await SequencerStaking.activeSequencers();
  expect(sequencers.toHuman().Arbitrum).toContain(
    testUser1.keyRingPair.address,
  );
  expect(sequencers.toHuman().Arbitrum).toContain(
    testUser2.keyRingPair.address,
  );
  testUser2Address = testUser2.keyRingPair.address.toString();
  testUser1.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(GASP_ASSET_ID);
});

it("Active Sequencer -> Active -> canceled update -> Can not leave", async () => {
  const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  await signTx(
    api,
    await SequencerStaking.leaveSequencerStaking(chain),
    testUser1.keyRingPair,
  ).then((events) => {
    expectExtrinsicSucceed(events);
  });
  await waitForNBlocks(
    (await Rolldown.disputePeriodLength(chain)).toNumber() + 5,
  );
  await signTx(
    api,
    await SequencerStaking.unstake(chain),
    testUser1.keyRingPair,
  ).then((events) => {
    const res = expectExtrinsicFail(events);
    expect(res.data.toString()).toContain(
      "SequencerLastUpdateStillInDisputePeriod",
    );
  });
  await waitForNBlocks(await Rolldown.disputePeriodLength());
  await Rolldown.waitForReadRights(testUser2Address, 50, chain);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2Address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, false)
        .on(chain)
        .buildUnsafe(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks(
    (await Rolldown.disputePeriodLength(chain)).toNumber() + 5,
  );

  //then the user must be able to unstake and leave
  await signTx(
    api,
    await SequencerStaking.unstake(chain),
    testUser1.keyRingPair,
  ).then((events) => {
    expectExtrinsicSucceed(events);
  });
  const res = await SequencerStaking.sequencerStake(
    testUser1.keyRingPair.address,
    chain,
  );
  expect(res.toHuman()).toBe("0");
});

it("GIVEN a slashed sequencer, WHEN slashed it can not provide any update / cancel until the next session ( if gets elected )", async () => {
  let updaterRightsStatus: any;
  const { reqIdCanceled } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  updaterRightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  expect(updaterRightsStatus.cancelRights.toString()).toBe("1");
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  //we approve the cancellation
  await Rolldown.waitForReadRights(testUser2Address, 50, chain);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2Address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, true)
        .on(chain)
        .buildUnsafe(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks(disputePeriodLength + 1);
  updaterRightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  const activeSequencers = (
    await SequencerStaking.activeSequencers()
  ).toHuman();
  expect(activeSequencers.Arbitrum).not.toContain(
    testUser1.keyRingPair.address,
  );
  expect(updaterRightsStatus.cancelRights.toString()).toBe("0");
  expect(updaterRightsStatus.readRights.toString()).toBe("0");
});

it.each(["justified", "not justified"])(
  "GIVEN a cancel, WHEN is %s then its stored for the batch corresponding to the network",
  async (resolutionType) => {
    const { reqIdCanceled } = await createAnUpdateAndCancelIt(
      testUser1,
      testUser2Address,
      chain,
    );
    const cancelJustified = resolutionType === "justified";
    await Rolldown.waitForReadRights(testUser2Address, 50, chain);
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    const cancelResolutionEvents = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        testUser2Address,
        new L2Update(api)
          .withCancelResolution(txIndex, reqIdCanceled, cancelJustified)
          .on(chain)
          .buildUnsafe(),
      ),
    );
    await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
    const l2Request = await Rolldown.getL2Request(reqIdCanceled, chain);
    expect(l2Request.cancel.requestId.id).toEqual(reqIdCanceled);
    expect(l2Request.cancel.canceler).toEqual(testUser2Address);
    expect(l2Request.cancel.updater).toEqual(testUser1.keyRingPair.address);
    expect(l2Request.cancel.range.start).toEqual(txIndex);
    expect(l2Request.cancel.range.end).toEqual(txIndex);
  },
);
