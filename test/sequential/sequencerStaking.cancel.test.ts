/*
 *
 * @group sequencerStaking
 */

import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import {
  L2Update,
  Rolldown,
  createAnUpdateAndCancelIt,
  leaveSequencing,
} from "../../utils/rollDown/Rolldown";
import { MangataGenericEvent, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { expectExtrinsicSucceed, waitForNBlocks } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";
import { GASP_ASSET_ID } from "../../utils/Constants";

let chain: any;
let testUser1: User;
let testUser2: User;
let testUser2Address: string;

async function createAUserWithGASP() {
  const [user] = setupUsers();
  await Sudo.asSudoFinalized(Assets.mintNative(user));
  return user;
}

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
});

beforeEach(async () => {
  //There shouldn't be any sequencer in activeSequencers
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  const activeSequencers = await SequencerStaking.activeSequencers();
  for (const chain in activeSequencers.toHuman()) {
    for (const seq of activeSequencers.toHuman()[chain] as string[]) {
      if (seq !== null) {
        await leaveSequencing(seq);
      }
    }
  }

  chain = "Ethereum";
  const notYetSequencer = await createAUserWithGASP();
  testUser2 = await createAUserWithGASP();
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  await signTx(
    await getApi(),
    await SequencerStaking.provideSequencerStaking(
      minToBeSequencer.addn(1000),
      "Ethereum",
    ),
    notYetSequencer.keyRingPair,
  ).then((events) => {
    expectExtrinsicSucceed(events);
  });
  const sequencers = await SequencerStaking.activeSequencers();
  expect(sequencers.toHuman().Ethereum).toContain(
    notYetSequencer.keyRingPair.address,
  );
  await signTx(
    await getApi(),
    await SequencerStaking.provideSequencerStaking(
      minToBeSequencer.addn(1000),
      "Ethereum",
    ),
    testUser2.keyRingPair,
  ).then((events) => {
    expectExtrinsicSucceed(events);
  });
  testUser1 = notYetSequencer;
  testUser2Address = testUser2.ethAddress.toString();
  testUser1.addAsset(GASP_ASSET_ID);
  testUser2.addAsset(GASP_ASSET_ID);
});
it("GIVEN a sequencer, WHEN <correctly> canceling an update THEN a % of the slash is given to it", async () => {
  const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await Rolldown.waitForReadRights(testUser2Address, 50, "Ethereum");
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  //we approve the cancellation
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
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const slashRewardCanceler = testUser2
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser2.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  const slashFineUpdater = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(slashRewardCanceler).bnEqual(
    (await SequencerStaking.slashFineAmount()).muln(0.2),
  );
  expect(slashFineUpdater).bnEqual(await SequencerStaking.slashFineAmount());
});

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update THEN my slash is burned", async () => {
  const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await Rolldown.waitForReadRights(testUser2Address, 50, "Ethereum");
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  //the cancellation is incorrectly
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
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const slashRewardUpdater = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  const slashFineCanceler = testUser2
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser2.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(slashRewardUpdater).bnEqual(BN_ZERO);
  expect(slashFineCanceler).bnEqual(await SequencerStaking.slashFineAmount());
});

it("GIVEN a sequencer, WHEN <no> canceling an update THEN no slash is applied", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await createAnUpdateAndCancelIt(testUser1, testUser2Address, chain, false);
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const slashRewardUpdater = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  const slashFineUpdater = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(slashRewardUpdater).bnEqual(BN_ZERO);
  expect(slashFineUpdater).bnEqual(BN_ZERO);
});

it("GIVEN a slashed sequencer, WHEN slashed it can not provide any update / cancel until the next session ( if gets elected )", async () => {
  let updaterRightsStatus: any;
  const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await Rolldown.waitForReadRights(testUser2Address, 60, "Ethereum");
  updaterRightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  expect(updaterRightsStatus.cancelRights.toString()).toBe("1");
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  //we approve the cancellation
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
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  updaterRightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser1.keyRingPair.address,
  );
  expect(updaterRightsStatus.cancelRights.toString()).toBe("0");
});

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update AND some pending updates/cancels, THEN it can be still slashed and kicked, cancels & updates will be executed.", async () => {
  let cancelResolutionEvents: MangataGenericEvent[];
  let sequencers: any;
  const judge = await createAUserWithGASP();
  await signTx(
    await getApi(),
    await SequencerStaking.provideSequencerStaking(
      (await SequencerStaking.minimalStakeAmount()).addn(1000),
      "Ethereum",
    ),
    judge.keyRingPair,
  ).then((events) => {
    expectExtrinsicSucceed(events);
  });
  sequencers = await SequencerStaking.activeSequencers();
  expect(sequencers.toHuman().Ethereum).toContain(judge.keyRingPair.address);
  await Rolldown.waitForReadRights(testUser1.keyRingPair.address);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  const { reqIdCanceled: reqIdCanceled1, api: api1 } =
    await createAnUpdateAndCancelIt(testUser1, testUser2Address, chain);
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  const txIndex1 = await Rolldown.lastProcessedRequestOnL2(chain);
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api1)
        .withCancelResolution(txIndex1, reqIdCanceled1, false)
        .on("Ethereum")
        .build(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await signTx(
    await getApi(),
    await SequencerStaking.provideSequencerStaking(
      (await SequencerStaking.minimalStakeAmount()).addn(1000),
      "Ethereum",
    ),
    testUser2.keyRingPair,
  ).then((events) => {
    expectExtrinsicSucceed(events);
  });
  sequencers = await SequencerStaking.activeSequencers();
  expect(sequencers.toHuman().Ethereum).toContain(judge.keyRingPair.address);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await Rolldown.waitForReadRights(testUser2.keyRingPair.address);
  const { reqIdCanceled: reqIdCanceled2, api: api2 } =
    await createAnUpdateAndCancelIt(
      testUser2,
      testUser1.keyRingPair.address,
      chain,
    );
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  const txIndex2 = await Rolldown.lastProcessedRequestOnL2(chain);
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api2)
        .withCancelResolution(txIndex2, reqIdCanceled2, false)
        .on("Ethereum")
        .build(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const slashFineTestUser1 = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  const slashFineTestUser2 = testUser2
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser2.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(slashFineTestUser1).bnGt(BN_ZERO);
  expect(slashFineTestUser2).bnGt(BN_ZERO);
});
