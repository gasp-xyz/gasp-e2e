import { BN_TEN, BN_TEN_THOUSAND, BN_THOUSAND } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { Ferry } from "../../utils/rollDown/Ferry";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { ApiPromise } from "@polkadot/api";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import {
  expectMGAExtrinsicSuDidSuccess,
  filterAndStringifyFirstEvent,
  waitForEvents,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { stringToBN, waitForNBlocks } from "../../utils/utils";

let api: ApiPromise;
let recipient: User;
let sequencer: User;
let ferrier: User;
let chain: any;
let waitingPeriod: number;
let txIndex: number;
let gaspL1Address: string;

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  api = getApi();
  waitingPeriod = (await SequencerStaking.getBlocksNumberForSeqUpdate()) * 5;
  gaspL1Address = await Assets.getAssetAddress(GASP_ASSET_ID);
});

beforeEach(async () => {
  await SequencerStaking.removeAllSequencers();
  [recipient, sequencer] = setupUsers();
  const extrinsic = await SequencerStaking.provideSequencerStaking(
    (await SequencerStaking.minimalStakeAmount()).muln(2),
    chain,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(sequencer),
    Sudo.sudoAs(sequencer, extrinsic),
  );
  ferrier = await Ferry.setupFerrier("EthAnvil");
  txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  recipient.addAsset(GASP_ASSET_ID);
  ferrier.addAsset(GASP_ASSET_ID);
  sequencer.addAsset(GASP_ASSET_ID);
});

it("GIVEN a ferrier, when ferry a deposit THEN user gets tokens BEFORE the dispute period AND the ferrier will get those back after the dispute period", async () => {
  let ferrierDiff: any;
  await Rolldown.waitForReadRights(
    sequencer.keyRingPair.address,
    waitingPeriod,
    chain,
  );
  const ferryTip = BN_TEN;
  const update1 = new L2Update(api)
    .withDeposit(
      txIndex,
      recipient.keyRingPair.address,
      gaspL1Address,
      BN_TEN_THOUSAND,
      0,
      ferryTip,
    )
    .on(chain);
  const update2 = new L2Update(api)
    .withDeposit(
      txIndex,
      recipient.keyRingPair.address,
      gaspL1Address,
      BN_TEN_THOUSAND,
      0,
      ferryTip,
    )
    .withDeposit(
      txIndex + 1,
      recipient.keyRingPair.address,
      gaspL1Address,
      BN_THOUSAND,
    )
    .on(chain)
    .buildUnsafe();

  await ferrier.refreshAmounts(AssetWallet.BEFORE);
  const ferryEvent = await Ferry.ferryThisDeposit(
    ferrier,
    update1.pendingDeposits[0],
    "EthAnvil",
  );
  await recipient.refreshAmounts(AssetWallet.BEFORE);
  await ferrier.refreshAmounts(AssetWallet.AFTER);
  const filteredEvent = await filterAndStringifyFirstEvent(
    ferryEvent,
    "TransactionFeePaid",
  );
  const transactionFee = await stringToBN(filteredEvent.actualFee);
  ferrierDiff = ferrier
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.free!.sub(
      ferrier.getAsset(GASP_ASSET_ID)?.amountAfter.free!,
    );
  expect(ferrierDiff).bnEqual(
    transactionFee.add(BN_TEN_THOUSAND).sub(ferryTip),
  );
  expect(recipient.getAsset(GASP_ASSET_ID)?.amountBefore.free!).bnEqual(
    BN_TEN_THOUSAND.sub(ferryTip),
  );

  await ferrier.refreshAmounts(AssetWallet.BEFORE);
  const event1 = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      sequencer.keyRingPair.address,
      update1.buildUnsafe(),
    ),
  );
  await expectMGAExtrinsicSuDidSuccess(event1);
  await waitForEvents(
    api,
    "rolldown.RequestProcessedOnL2",
    (await Rolldown.disputePeriodLength()) * 4,
  );
  await ferrier.refreshAmounts(AssetWallet.AFTER);
  ferrierDiff = ferrier
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      ferrier.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  expect(ferrierDiff).bnEqual(BN_TEN_THOUSAND);

  const event2 = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(sequencer.keyRingPair.address, update2),
  );
  await expectMGAExtrinsicSuDidSuccess(event2);
  await waitForEvents(
    api,
    "rolldown.RequestProcessedOnL2",
    (await Rolldown.disputePeriodLength()) * 4,
  );
  await recipient.refreshAmounts(AssetWallet.AFTER);
  const recipientDiff = recipient
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      recipient.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  expect(recipientDiff).bnEqual(BN_THOUSAND);
});

it("[BUG] GIVEN a ferrier, when ferry a deposit THEN user gets tokens BEFORE the dispute period  AND WHEN a dispute happens AND resolution is True AND another update comes with the same id, THEN the ferrier will get those back after the dispute period", async () => {
  let event: any;
  const [judge] = setupUsers();
  const disputePeriodLength = await Rolldown.disputePeriodLength();
  const stakeAndJoinExtrinsic = await SequencerStaking.provideSequencerStaking(
    (await SequencerStaking.minimalStakeAmount()).addn(1000),
    chain,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(judge),
    Sudo.sudoAs(judge, stakeAndJoinExtrinsic),
  );
  await Rolldown.waitForReadRights(
    sequencer.keyRingPair.address,
    waitingPeriod,
    chain,
  );
  const ferryTip = BN_TEN;
  const update1 = new L2Update(api)
    .withDeposit(
      txIndex,
      recipient.keyRingPair.address,
      gaspL1Address,
      BN_TEN_THOUSAND,
      0,
      ferryTip,
    )
    .on(chain);
  await Ferry.ferryThisDeposit(ferrier, update1.pendingDeposits[0], "EthAnvil");
  await recipient.refreshAmounts(AssetWallet.BEFORE);
  await ferrier.refreshAmounts(AssetWallet.BEFORE);
  expect(recipient.getAsset(GASP_ASSET_ID)?.amountBefore.free!).bnEqual(
    BN_TEN_THOUSAND.sub(ferryTip),
  );
  await Rolldown.waitForReadRights(sequencer.keyRingPair.address);
  event = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      sequencer.keyRingPair.address,
      update1.buildUnsafe(),
    ),
  );
  await expectMGAExtrinsicSuDidSuccess(event);
  const disputeEndBlockNumber = Rolldown.getDisputeEndBlockNumber(event);
  const cancel = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      await Rolldown.cancelRequestFromL1(chain, disputeEndBlockNumber),
    ),
  );
  await waitSudoOperationSuccess(cancel, "SudoAsDone");
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  const reqIdCanceled = Rolldown.getRequestIdFromCancelEvent(cancel);
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, true)
        .on(chain)
        .buildUnsafe(),
    ),
  );

  await Rolldown.waitForReadRights(sequencer.keyRingPair.address);
  event = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      sequencer.keyRingPair.address,
      update1.buildUnsafe(),
    ),
  );
  await expectMGAExtrinsicSuDidSuccess(event);
  await waitForNBlocks(disputePeriodLength);

  await recipient.refreshAmounts(AssetWallet.AFTER);
  await ferrier.refreshAmounts(AssetWallet.AFTER);
  //tokens must be returned to ferrier, but there are on recipient's account
  expect(recipient.getAsset(GASP_ASSET_ID)?.amountBefore.free!).bnEqual(
    recipient.getAsset(GASP_ASSET_ID)?.amountAfter.free!,
  );
  expect(ferrier.getAsset(GASP_ASSET_ID)?.amountBefore.free!).bnEqual(
    ferrier.getAsset(GASP_ASSET_ID)?.amountAfter.free!,
  );
});
