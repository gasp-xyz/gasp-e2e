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
} from "../../utils/rollDown/Rolldown";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { waitBlockNumber, waitForNBlocks } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION } from "gasp-sdk";
import BN from "bn.js";

let api: any;
const chain = "Ethereum";
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
  const slashFineAmount = await SequencerStaking.slashFineAmount();
  const { reqIdCanceled, disputeEndBlockNumber } =
    await createAnUpdateAndCancelIt(testUser1, testUser2Address, chain);
  await Rolldown.waitForReadRights(testUser2Address);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  const cancelResolutionEvents = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2Address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, true)
        .on(chain)
        .buildUnsafe(),
    ),
  );
  const disputeEndBlockNumber2 = Rolldown.getDisputeEndBlockNumber(
    cancelResolutionEvents,
  );
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitBlockNumber(
    (disputeEndBlockNumber2 + 1).toString(),
    disputePeriodLength * 2,
  );
  const resolutionEvents = await Rolldown.waitForL2UpdateExecuted(
    new BN(txIndex),
  );
  const filteredEvent = resolutionEvents.filter(
    (result: any) => result.method === "Slashed",
  );
  expect(filteredEvent[0].data[0]).bnEqual(GASP_ASSET_ID);
  expect(filteredEvent[0].data[1].toString()).toContain(
    testUser1.keyRingPair.address,
  );
  expect(filteredEvent[0].data[2]).bnEqual(BN_ZERO);
  expect(filteredEvent[0].data[3]).bnEqual(slashFineAmount.muln(0.8));

  const tokenAddress = testUser1.keyRingPair.address;
  const didDepositRun = await Rolldown.isTokenBalanceIncreased(
    tokenAddress,
    chain,
  );
  const isTokenGenerated = await Rolldown.wasAssetRegistered(
    disputeEndBlockNumber,
  );
  expect(didDepositRun).toBe(false);
  expect(isTokenGenerated).toBe(false);

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
  expect(cancelerRewardValue).bnEqual(slashFineAmount.muln(0.2));
  expect(updaterPenaltyValue).bnEqual(slashFineAmount);
});

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update THEN my slash is burned", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const { reqIdCanceled, disputeEndBlockNumber } =
    await createAnUpdateAndCancelIt(testUser1, testUser2Address, chain);
  await Rolldown.waitForReadRights(testUser2Address);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
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
  await Rolldown.waitForL2UpdateExecuted(new BN(txIndex));

  const tokenAddress = testUser1.keyRingPair.address;
  const didDepositRun = await Rolldown.isTokenBalanceIncreased(
    tokenAddress,
    chain,
  );
  const isTokenGenerated = await Rolldown.wasAssetRegistered(
    disputeEndBlockNumber,
  );
  expect(didDepositRun).toBe(false);
  expect(isTokenGenerated).toBe(false);

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
  const { disputeEndBlockNumber, txIndex } = await createAnUpdate(
    testUser1,
    chain,
    0,
    null,
    BN_MILLION,
  );
  //if we don't cancel the update then function RegisteredAsset runs in next block after disputeEndBlockNumber
  const registrationBlock = disputeEndBlockNumber + 1;
  await Rolldown.waitForL2UpdateExecuted(new BN(txIndex));
  const assetId = await Rolldown.getRegisteredAssetId(registrationBlock);
  testUser1.addAsset(assetId);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const updaterPenaltyValue = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  expect(updaterPenaltyValue).bnEqual(BN_ZERO);
  expect(testUser1.getAsset(assetId)?.amountAfter.free!).bnEqual(BN_MILLION);
});

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update AND some pending updates/cancels, THEN it can be still slashed and kicked, cancels & updates will be executed.", async () => {
  const [judge] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(judge),
    Sudo.sudoAs(judge, stakeAndJoinExtrinsic),
  );

  const {
    txIndex: txIndex1,
    reqIdCanceled: reqIdCanceled1,
    disputeEndBlockNumber: disputeEndBlockNumber1,
  } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2.keyRingPair.address,
    chain,
  );
  //lets wait for 3 blocks to have evth synced.
  await waitForNBlocks(3);
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
    .buildUnsafe();
  const {
    reqIdCanceled: reqIdCanceled2,
    disputeEndBlockNumber: disputeEndBlockNumber2,
  } = await createAnUpdateAndCancelIt(
    testUser2,
    testUser1.keyRingPair.address,
    chain,
    updateValue,
  );
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  const cancelResolutionEvent1 = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex1, reqIdCanceled1, false)
        .on(chain)
        .buildUnsafe(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvent1, "SudoAsDone");
  const txId = Rolldown.getUpdateIdFromEvents(cancelResolutionEvent1);
  await Rolldown.waitForL2UpdateExecuted(new BN(txId));
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const cancelResolutionEvent2 = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex3, reqIdCanceled2, false)
        .on(chain)
        .buildUnsafe(),
    ),
  );
  await waitSudoOperationSuccess(cancelResolutionEvent2, "SudoAsDone");
  const txId2 = Rolldown.getUpdateIdFromEvents(cancelResolutionEvent2);
  await Rolldown.waitForL2UpdateExecuted(new BN(txId2));

  const didDeposit1Run = await Rolldown.isTokenBalanceIncreased(
    testUser1.keyRingPair.address,
    chain,
  );
  const isToken1Generated = await Rolldown.wasAssetRegistered(
    disputeEndBlockNumber1,
  );
  const didDeposit2Run = await Rolldown.isTokenBalanceIncreased(
    testUser2.keyRingPair.address,
    chain,
  );
  const isToken2Generated = await Rolldown.wasAssetRegistered(
    disputeEndBlockNumber2,
  );
  expect(didDeposit1Run).toBe(false);
  expect(isToken1Generated).toBe(false);
  expect(didDeposit2Run).toBe(false);
  expect(isToken2Generated).toBe(false);

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

it("GIVEN a sequencer, WHEN <in-correctly> canceling an update AND cancelator provides staking THEN cancelator will be slashed but he will stay in activeSequncer pool", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const { reqIdCanceled } = await createAnUpdateAndCancelIt(
    testUser1,
    testUser2Address,
    chain,
  );
  await Rolldown.waitForReadRights(testUser2Address);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  stakeAndJoinExtrinsic = await SequencerStaking.provideSequencerStaking(
    (await SequencerStaking.minimalStakeAmount()).muln(2),
    chain,
  );
  //the cancellation is incorrectly
  const cancelResolutionEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser2Address,
      new L2Update(api)
        .withCancelResolution(txIndex, reqIdCanceled, false)
        .on(chain)
        .buildUnsafe(),
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
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
  await waitForNBlocks(disputePeriodLength + 1);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const sequencers = await SequencerStaking.activeSequencers();
  const testUser2PenaltyValue = testUser2
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser2.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );
  const testUser2RightsStatus = await Rolldown.sequencerRights(
    chain,
    testUser2.keyRingPair.address,
  );
  expect(sequencers.toHuman().Ethereum).toContain(testUser2Address);
  expect(testUser2PenaltyValue).bnEqual(
    await SequencerStaking.slashFineAmount(),
  );
  expect(testUser2RightsStatus.readRights.toString()).toBe("1");
  expect(testUser2RightsStatus.cancelRights.toString()).toBe("1");
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
    .buildUnsafe();
  const { reqIdCanceled: reqIdCanceled2 } = await createAnUpdateAndCancelIt(
    testUser2,
    testUser1.keyRingPair.address,
    chain,
    updateValue,
  );
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  const cancelResolutionEvent1 = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex1, reqIdCanceled1, false)
        .on(chain)
        .buildUnsafe(),
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
  await Rolldown.waitForReadRights(judge.keyRingPair.address);
  const cancelResolutionEvent2 = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      judge.keyRingPair.address,
      new L2Update(api)
        .withCancelResolution(txIndex3, reqIdCanceled2, false)
        .on(chain)
        .buildUnsafe(),
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
