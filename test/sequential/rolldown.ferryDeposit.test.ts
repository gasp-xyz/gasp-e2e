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
  filterAndStringifyFirstEvent,
  waitForEvents,
} from "../../utils/eventListeners";
import { stringToBN } from "../../utils/utils";

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
  await SequencerStaking.setupASequencer(sequencer, chain);
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
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      sequencer.keyRingPair.address,
      update1.buildUnsafe(),
    ),
  );
  await waitForEvents(
    api,
    "rolldown.RequestProcessedOnL2",
    (await Rolldown.disputePeriodLength()).toNumber() * 4,
  );
  await ferrier.refreshAmounts(AssetWallet.AFTER);
  ferrierDiff = ferrier
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      ferrier.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  expect(ferrierDiff).bnEqual(BN_TEN_THOUSAND);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(sequencer.keyRingPair.address, update2),
  );
  await waitForEvents(
    api,
    "rolldown.RequestProcessedOnL2",
    (await Rolldown.disputePeriodLength()).toNumber() * 4,
  );
  await recipient.refreshAmounts(AssetWallet.AFTER);
  const recipientDiff = recipient
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      recipient.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    );
  expect(recipientDiff).bnEqual(BN_THOUSAND);
});
