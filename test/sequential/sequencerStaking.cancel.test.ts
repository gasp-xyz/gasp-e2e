/*
 *
 * @group sequencerStaking
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_MILLION, MangataGenericEvent, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { expectExtrinsicSucceed, waitForNBlocks } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import {
  waitNewBlock,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";
import { MGA_ASSET_ID } from "../../utils/Constants";

async function waitSequencerAsSelected(seq: User, n: number = 80) {
  let selectedSequencer: any;
  const api = getApi();
  selectedSequencer = (
    await api.query.sequencerStaking.selectedSequencer()
  ).toHuman();
  while (selectedSequencer.Ethereum !== seq.keyRingPair.address && n > 0) {
    await waitNewBlock();
    selectedSequencer = (
      await api.query.sequencerStaking.selectedSequencer()
    ).toHuman();
    n--;
  }
}

async function createACollatorUser() {
  const [user] = setupUsers();
  await Sudo.asSudoFinalized(Assets.mintNative(user));
  return user;
}

async function leaveSequencingIfAlreadySequencer(userAddr: string) {
  const stakedEth = await SequencerStaking.sequencerStake(userAddr, "Ethereum");
  const stakedArb = await SequencerStaking.sequencerStake(userAddr, "Arbitrum");
  let chain = "";
  if (stakedEth.toHuman() !== "0") {
    chain = "Ethereum";
  } else if (stakedArb.toHuman() !== "0") {
    chain = "Arbitrum";
  }
  if (chain !== "") {
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        userAddr,
        await SequencerStaking.leaveSequencerStaking(chain as ChainName),
      ),
    );
    await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        userAddr,
        await SequencerStaking.unstake(chain as ChainName),
      ),
    );
  }
}

async function createAnUpdateAndCancelIt(
  seq: User,
  canceler: User,
  chain: ChainName = "Ethereum",
  cancellation: boolean = true,
) {
  const seqAddress = seq.keyRingPair.address;
  const cancelerAddress = canceler.keyRingPair.address;
  await Rolldown.waitForReadRights(seqAddress, 50, chain);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const api = getApi();
  const update = new L2Update(api)
    .withDeposit(txIndex, seqAddress, seqAddress, BN_MILLION)
    .on(chain)
    .build();
  let reqId = 0;
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(seqAddress, update),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events, "SudoAsDone");
    reqId = Rolldown.getRequestIdFromEvents(events);
  });
  //const disputePeriodStartBlock = await getBlockNumber();
  let reqIdCanceled: number = 0;
  if (cancellation === true) {
    const cancel = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        cancelerAddress,
        await Rolldown.cancelRequestFromL1(chain, reqId),
      ),
    );
    await waitSudoOperationSuccess(cancel, "SudoAsDone");
    reqIdCanceled = Rolldown.getRequestIdFromCancelEvent(cancel);
  }
  return { txIndex, api, reqId, reqIdCanceled };
}

const preSetupSequencers = {
  Ethereum: "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
  Arbitrum: "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc",
};

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  //Add a few tokes because some tests may end up on slashing them
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      preSetupSequencers.Ethereum,
      await SequencerStaking.provideSequencerStaking(BN_ZERO, "Ethereum"),
    ),
    Sudo.sudoAsWithAddressString(
      preSetupSequencers.Arbitrum,
      await SequencerStaking.provideSequencerStaking(BN_ZERO, "Arbitrum"),
    ),
  );
});

beforeEach(async () => {
  //TODO: Replace this by some monitoring of the active queue.
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  const activeSequencers = await SequencerStaking.activeSequencers();
  let anySequencerGone = false;
  for (const chain in activeSequencers.toHuman()) {
    for (const seq of activeSequencers.toHuman()[chain] as string[]) {
      if (
        seq !== preSetupSequencers.Ethereum &&
        seq !== preSetupSequencers.Arbitrum
      ) {
        await leaveSequencingIfAlreadySequencer(seq);
        anySequencerGone = true;
      }
    }
  }
  if (anySequencerGone) {
    await waitForNBlocks(10);
  }
});

describe("Update cancellation -", () => {
  let chain: any;
  let testUser1: User;
  let testUser2: User;
  let testUser2Address: string;
  beforeEach(async () => {
    chain = "Ethereum";
    const notYetSequencer = await createACollatorUser();
    testUser2 = await createACollatorUser();
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
    testUser1.addAsset(MGA_ASSET_ID);
    testUser2.addAsset(MGA_ASSET_ID);
  });
  it("GIVEN a sequencer, WHEN <correctly> canceling an update THEN a % of the slash is given to it", async () => {
    const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
      testUser1,
      testUser2,
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
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const slashRewardCanceler = testUser2
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free!.sub(
        testUser2.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
      );
    const slashFineUpdater = testUser1
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.reserved!.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!,
      );
    expect(slashRewardCanceler).bnGt(BN_ZERO);
    expect(slashRewardCanceler).bnLt(await SequencerStaking.slashFineAmount());
    expect(slashFineUpdater).bnEqual(await SequencerStaking.slashFineAmount());
  });

  it("GIVEN a sequencer, WHEN <in-correctly> canceling an update THEN my slash is burned", async () => {
    const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
      testUser1,
      testUser2,
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
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const slashRewardUpdater = testUser1
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free!.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
      );
    const slashFineCanceler = testUser2
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.reserved!.sub(
        testUser2.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!,
      );
    expect(slashRewardUpdater).bnEqual(BN_ZERO);
    expect(slashFineCanceler).bnEqual(await SequencerStaking.slashFineAmount());
  });

  it("GIVEN a sequencer, WHEN <no> canceling an update THEN no slash is applied", async () => {
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await createAnUpdateAndCancelIt(testUser1, testUser2, chain, false);
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const slashRewardUpdater = testUser1
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free!.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
      );
    const slashFineUpdater = testUser1
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.reserved!.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!,
      );
    expect(slashRewardUpdater).bnEqual(BN_ZERO);
    expect(slashFineUpdater).bnEqual(BN_ZERO);
  });

  it("GIVEN a slashed sequencer, WHEN slashed it can not provide any update / cancel until the next session ( if gets elected )", async () => {
    const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
      testUser1,
      testUser2,
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
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    const updaterRightsStatus = await Rolldown.sequencerRights(
      chain,
      testUser1.keyRingPair.address,
    );
    const testUser2RightsStatus = await Rolldown.sequencerRights(
      chain,
      testUser2.keyRingPair.address,
    );
    expect(updaterRightsStatus.cancelRights.toString()).toBe("0");
    expect(testUser2RightsStatus.cancelRights.toString()).toBe("1");
  });

  it("GIVEN a sequencer, WHEN <in-correctly> canceling an update AND some pending updates/cancels, THEN it can be still slashed and kicked, cancels & updates will be executed.", async () => {
    let cancelResolutionEvents: MangataGenericEvent[];
    let sequencers: any;
    const judge = await createACollatorUser();
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
    await waitSequencerAsSelected(testUser1);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    const { reqIdCanceled: reqIdCanceled1, api: api1 } =
      await createAnUpdateAndCancelIt(testUser1, testUser2, chain);
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    const txIndex1 = await Rolldown.lastProcessedRequestOnL2(chain);
    await waitSequencerAsSelected(judge);
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
    await waitSequencerAsSelected(testUser2);
    const { reqIdCanceled: reqIdCanceled2, api: api2 } =
      await createAnUpdateAndCancelIt(testUser2, testUser1, chain);
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    const txIndex2 = await Rolldown.lastProcessedRequestOnL2(chain);
    await waitSequencerAsSelected(judge);
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
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.reserved!.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!,
      );
    const slashFineTestUser2 = testUser2
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.reserved!.sub(
        testUser2.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!,
      );
    expect(slashFineTestUser1).bnGt(BN_ZERO);
    expect(slashFineTestUser2).bnGt(BN_ZERO);
  });
});
