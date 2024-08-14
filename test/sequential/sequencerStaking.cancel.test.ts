/*
 *
 * @group sequencerCancellation
 */

import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import {
  L2Update,
  Rolldown,
  createAnUpdate,
  createAnUpdateAndCancelIt,
  leaveSequencing,
} from "../../utils/rollDown/Rolldown";
import { initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { waitForNBlocks } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION } from "gasp-sdk";

let chain: any;
let testUser1: User;
let testUser2: User;
let testUser2Address: string;
let disputePeriodLength: number;
let providingExtrinsic: any;

beforeAll(async () => {
  await initApi();
  await setupApi();
  disputePeriodLength = (await Rolldown.disputePeriodLength()).toNumber();
});

beforeEach(async () => {
  //There shouldn't be any sequencer in activeSequencers
  [testUser1, testUser2] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
  );
  const activeSequencers = await SequencerStaking.activeSequencers();
  for (const chain in activeSequencers.toHuman()) {
    for (const seq of activeSequencers.toHuman()[chain] as string[]) {
      if (seq !== null) {
        await leaveSequencing(seq);
      }
    }
  }
  chain = "Ethereum";
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  providingExtrinsic = await SequencerStaking.provideSequencerStaking(
    minToBeSequencer.addn(1000),
    "Ethereum",
  );
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, providingExtrinsic),
    Sudo.sudoAs(testUser2, providingExtrinsic),
  );
  const sequencers = await SequencerStaking.activeSequencers();
  expect(sequencers.toHuman().Ethereum).toContain(
    testUser1.keyRingPair.address,
  );
  expect(sequencers.toHuman().Ethereum).toContain(
    testUser2.keyRingPair.address,
  );
  testUser2Address = testUser2.keyRingPair.address.toString();
  testUser1.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(GASP_ASSET_ID);
});
it("GIVEN a sequencer, WHEN <correctly> canceling an update THEN a % of the slash is given to it", async () => {
  const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  await waitForNBlocks(disputePeriodLength);
  await Rolldown.waitForReadRights(testUser2Address);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  //we approve the cancellation
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2Address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, true)
        .on("Ethereum")
        .build(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks(disputePeriodLength);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const cancelerRewardValue = testUser2
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser2.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  const updaterPenaltyValue = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(cancelerRewardValue).bnEqual(
    (await SequencerStaking.slashFineAmount()).muln(0.2),
  );
  expect(updaterPenaltyValue).bnEqual(await SequencerStaking.slashFineAmount());
});

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update THEN my slash is burned", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  //await waitForNBlocks(disputePeriodLength);
  await Rolldown.waitForReadRights(testUser2Address);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  //the cancellation is incorrectly
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2Address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, false)
        .on("Ethereum")
        .build(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks(disputePeriodLength);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const updaterDiffValue = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  const cancelerPenaltyValue = testUser2
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser2.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(updaterDiffValue).bnEqual(BN_ZERO);
  expect(cancelerPenaltyValue).bnEqual(
    await SequencerStaking.slashFineAmount(),
  );
});

it("GIVEN a sequencer, WHEN <no> canceling an update THEN no slash is applied", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await createAnUpdate(testUser1, chain);
  await waitForNBlocks(disputePeriodLength);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const updaterPenaltyValue = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(updaterPenaltyValue).bnEqual(BN_ZERO);
});

it("GIVEN a slashed sequencer, WHEN slashed it can not provide any update / cancel until the next session ( if gets elected )", async () => {
  let updaterRightsStatus: any;
  const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  await waitForNBlocks(disputePeriodLength);
  updaterRightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  expect(updaterRightsStatus.cancelRights.toString()).toBe("1");
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  //we approve the cancellation
  await Rolldown.waitForReadRights(testUser2Address);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2Address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, true)
        .on("Ethereum")
        .build(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks(disputePeriodLength);
  updaterRightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  const activeSequencers = (
    await SequencerStaking.activeSequencers()
  ).toHuman();
  expect(activeSequencers.Ethereum).not.toContain(
    testUser1.keyRingPair.address,
  );
  expect(updaterRightsStatus.cancelRights.toString()).toBe("0");
  expect(updaterRightsStatus.readRights.toString()).toBe("0");
});

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update AND some pending updates/cancels, THEN it can be still slashed and kicked, cancels & updates will be executed.", async () => {
  const [judge] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(judge),
    Sudo.sudoAs(judge, providingExtrinsic),
  );

  const {
    api,
    txIndex: txIndex1,
    reqIdCanceled: reqIdCanceled1,
  } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2.keyRingPair.address,
    chain,
  );
  await waitForNBlocks(disputePeriodLength);
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
  await waitForNBlocks(disputePeriodLength);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  const cancelResolutionEvent1 = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex1, reqIdCanceled1, false)
        .on("Ethereum")
        .build(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvent1, "SudoAsDone");
  await waitForNBlocks(disputePeriodLength);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const cancelResolutionEvent2 = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex3, reqIdCanceled2, false)
        .on("Ethereum")
        .build(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvent2, "SudoAsDone");
  await waitForNBlocks(disputePeriodLength);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
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
  const sequencers = await SequencerStaking.activeSequencers();
  expect(sequencers.toHuman().Ethereum).not.toContain(
    testUser1.keyRingPair.address,
  );
  expect(sequencers.toHuman().Ethereum).not.toContain(
    testUser2.keyRingPair.address,
  );
  expect(testUser1PenaltyValue).bnEqual(
    await SequencerStaking.slashFineAmount(),
  );
  expect(testUser2PenaltyValue).bnEqual(
    await SequencerStaking.slashFineAmount(),
  );
});
