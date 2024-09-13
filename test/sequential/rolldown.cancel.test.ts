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
import { waitForNBlocks } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION } from "gasp-sdk";

let api: any;
let chain: any;
let testUser1: User;
let testUser2: User;
let testUser2Address: string;
let disputePeriodLength: number;
let stakeAndJoinExtrinsic: any;

beforeAll(async () => {
  await initApi();
  await setupApi();
  api = getApi();
  disputePeriodLength = (await Rolldown.disputePeriodLength()).toNumber();
});

beforeEach(async () => {
  //There shouldn't be any sequencer in activeSequencers
  [testUser1, testUser2] = setupUsers();
  await SequencerStaking.removeAllSequencers();
  chain = "Arbitrum";
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

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update AND some pending updates/cancels AND users provide staking THEN users have read/cancel rights", async () => {
  const [judge] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(judge),
    Sudo.sudoAs(judge, stakeAndJoinExtrinsic),
  );

  const { txIndex: txIndex1, reqIdCanceled: reqIdCanceled1 } =
    await createAnUpdateAndCancelIt(
      testUser1,
      testUser2.keyRingPair.address,
      chain,
    );
  await waitForNBlocks(disputePeriodLength + 1);
  const txIndex2 = await Rolldown.lastProcessedRequestOnL2(chain);
  const txIndex3 = txIndex2 + 1;
  const updateValue = new L2Update(api)
    .withDeposit(
      txIndex2,
      testUser2.keyRingPair.address,
      testUser1.keyRingPair.address,
      BN_MILLION,
    )
    .withDeposit(
      txIndex3,
      testUser2.keyRingPair.address,
      testUser1.keyRingPair.address,
      BN_MILLION,
    )
    .on(chain)
    .build();
  const { reqIdCanceled: reqIdCanceled2 } = await createAnUpdateAndCancelIt(
    testUser2,
    testUser1.keyRingPair.address,
    chain,
    updateValue,
  );
  await Rolldown.waitForReadRights(judge.keyRingPair.address, 50, chain);
  const cancelResolutionEvent1 = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex1, reqIdCanceled1, false)
        .on(chain)
        .build(),
    ),
    Sudo.sudoAs(
      testUser2,
      await SequencerStaking.provideSequencerStaking(
        (await SequencerStaking.minimalStakeAmount()).muln(2),
        chain,
        false,
      ),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvent1, "SudoAsDone");
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await waitForNBlocks(disputePeriodLength + 1);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await Rolldown.waitForReadRights(judge.keyRingPair.address, 50, chain);
  const cancelResolutionEvent2 = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex3, reqIdCanceled2, false)
        .on(chain)
        .build(),
    ),
    Sudo.sudoAs(
      testUser1,
      await SequencerStaking.provideSequencerStaking(
        (await SequencerStaking.minimalStakeAmount()).muln(2),
        chain,
        false,
      ),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvent2, "SudoAsDone");
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await waitForNBlocks(disputePeriodLength + 1);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const testUser1RightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  const testUser2RightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  const testUser1PenaltyValue = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  const testUser2PenaltyValue = testUser2
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser2.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(testUser1PenaltyValue).bnEqual(
    await SequencerStaking.slashFineAmount(),
  );
  expect(testUser2PenaltyValue).bnEqual(
    await SequencerStaking.slashFineAmount(),
  );

  expect(testUser1RightsStatus.readRights.toString()).toBe("1");
  expect(testUser2RightsStatus.readRights.toString()).toBe("1");
  expect(testUser1RightsStatus.cancelRights.toString()).toBe("2");
  expect(testUser2RightsStatus.cancelRights.toString()).toBe("2");
});

it.each(["justified", "not justified"])(
  "GIVEN a cancel, WHEN is %s then its stored for the batch corresponding to the network",
  async (resolutionType) => {
    const { reqIdCanceled } = await createAnUpdateAndCancelIt(
      testUser1,
      testUser2Address,
      chain,
    );
    let cancelJustified: boolean;
    if (resolutionType === "justified") {
      cancelJustified = true;
    } else {
      cancelJustified = false;
    }
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
          .build(),
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
