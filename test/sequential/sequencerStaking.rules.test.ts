/*
 *
 * @group sequencerStaking
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import {
  L2Update,
  Rolldown,
  createAnUpdate,
} from "../../utils/rollDown/Rolldown";
import { BN_MILLION, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import {
  expectExtrinsicFail,
  expectExtrinsicSucceed,
  waitForNBlocks,
} from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import {
  ExtrinsicResult,
  filterAndStringifyFirstEvent,
  waitSudoOperationFail,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import BN from "bn.js";

async function findACollatorButNotSequencerUser() {
  const [user] = setupUsers();
  await Sudo.asSudoFinalized(Assets.mintNative(user));
  return user;
}

async function setupASequencer(chain: ChainName = "Ethereum") {
  const notYetSequencer = await findACollatorButNotSequencerUser();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(notYetSequencer));
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  await signTx(
    await getApi(),
    await SequencerStaking.provideSequencerStaking(
      minToBeSequencer.addn(1234),
      chain,
    ),
    notYetSequencer.keyRingPair,
  ).then((events) => {
    expectExtrinsicSucceed(events);
  });
  return notYetSequencer;
}

const preSetupSequencers = {
  Ethereum: "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
  Arbitrum: "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc",
};

describe("sequencerStaking", () => {
  beforeAll(async () => {
    await initApi();
    setupUsers();
    await setupApi();
    //Add a few tokes becaus esome tests may end up on slashing them
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
    await SequencerStaking.removeAddedSequencers(10);
  });

  it("An already collator joining as sequencer - On Active", async () => {
    const notYetSequencer = await setupASequencer();
    const sequencers = await SequencerStaking.activeSequencers();
    expect(sequencers.toHuman().Ethereum).toContain(
      notYetSequencer.keyRingPair.address,
    );
  });

  it("Active Sequencer - mint less than min amount -> Not in active", async () => {
    const notYetSequencer = await findACollatorButNotSequencerUser();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.subn(1234),
        "Ethereum",
        false,
      ),
      notYetSequencer.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    const sequencers = await SequencerStaking.activeSequencers();
    expect(sequencers.toHuman().Ethereum).not.toContain(
      notYetSequencer.keyRingPair.address,
    );
  });

  it("Active Sequencer -> Active -> pending update -> Can not leave", async () => {
    const chain = "Arbitrum";
    const notYetSequencer = await findACollatorButNotSequencerUser();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1234),
        chain,
      ),
      notYetSequencer.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    const sequencers = await SequencerStaking.activeSequencers();
    expect(sequencers.toHuman().Arbitrum).toContain(
      notYetSequencer.keyRingPair.address,
    );
    const seq = notYetSequencer;
    await Rolldown.waitForReadRights(seq.keyRingPair.address, 50, chain);
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        seq.keyRingPair.address,
        seq.keyRingPair.address,
        BN_MILLION,
      )
      .on(chain)
      .buildUnsafe();
    await signTx(api, update, seq.keyRingPair).then((events) => {
      expectExtrinsicSucceed(events);
    });
    await signTx(
      api,
      await SequencerStaking.leaveSequencerStaking(chain),
      seq.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    await signTx(
      api,
      await SequencerStaking.unstake(chain),
      seq.keyRingPair,
    ).then((events) => {
      const res = expectExtrinsicFail(events);
      expect([
        "SequencerLastUpdateStillInDisputePeriod",
        "SequencerAwaitingCancelResolution",
      ]).toContain(res.data.toString());
    });
    await waitForNBlocks(
      (await Rolldown.disputePeriodLength(chain)).toNumber(),
    );
    await signTx(
      api,
      await SequencerStaking.unstake(chain),
      seq.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    const res = await SequencerStaking.sequencerStake(
      seq.keyRingPair.address,
      chain,
    );
    expect(res.toHuman()).toBe("0");
  });

  it("Only a selected sequencer can submit updates", async () => {
    const api = getApi();
    const chain = "Arbitrum";
    const [user] = setupUsers();
    await Sudo.asSudoFinalized(Assets.mintNative(user));
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        user.keyRingPair.address,
        user.keyRingPair.address,
        BN_MILLION,
      )
      .on(chain)
      .buildUnsafe();

    // A user that did not provide stake -> can not submit update
    await signTx(api, update, user.keyRingPair).then((events) => {
      const eventResponse = getEventResultFromMangataTx(events);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(
        "OnlySelectedSequencerisAllowedToUpdate",
      );
    });
    // A user that did not provide the min stake -> can not submit update
    await signTx(
      api,
      await SequencerStaking.provideSequencerStaking(
        (await SequencerStaking.minimalStakeAmount()).subn(10),
        chain,
        false,
      ),
      user.keyRingPair,
    );
    const activeSequencers = await SequencerStaking.activeSequencers();
    expect(activeSequencers.toHuman().Arbitrum).not.toContain(
      user.keyRingPair.address,
    );
    await signTx(api, update, user.keyRingPair).then((events) => {
      const eventResponse = getEventResultFromMangataTx(events);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(
        "OnlySelectedSequencerisAllowedToUpdate",
      );
    });
    await signTx(
      api,
      await SequencerStaking.provideSequencerStaking(new BN(11), chain),
      user.keyRingPair,
    );
    const activeSequencersAfterUpdatingStake =
      await SequencerStaking.activeSequencers();
    expect(activeSequencersAfterUpdatingStake.toHuman().Arbitrum).toContain(
      user.keyRingPair.address,
    );
    await Rolldown.waitForReadRights(user.keyRingPair.address, 50, chain);
    await signTx(api, update, user.keyRingPair).then((events) => {
      const eventResponse = getEventResultFromMangataTx(events);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      const eventFiltered = filterAndStringifyFirstEvent(
        events,
        "L1ReadStored",
      );
      expect(eventFiltered.chain).toEqual(chain);
      expect(eventFiltered.sequencer).toEqual(user.keyRingPair.address);
      expect(eventFiltered.range.start).toEqual(txIndex.toString());
      expect(eventFiltered.range.end).toEqual(txIndex.toString());
    });
    await waitForNBlocks(
      (await Rolldown.disputePeriodLength(chain)).toNumber(),
    );
    await signTx(
      api,
      await SequencerStaking.leaveSequencerStaking(chain),
      user.keyRingPair,
    );
  });

  it("A selected sequencer with read rights can submit updates", async () => {
    const chain = "Ethereum";
    const sequencer = await setupASequencer(chain);
    await createAnUpdate(sequencer, chain);
    const sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatus.readRights.toString()).toBe("0");
    expect(sequencerStatus.cancelRights.toString()).toBe("1");

    const api = getApi();
    const txIndex = await Rolldown.lastProcessedRequestOnL2();
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_MILLION,
      )
      .on()
      .buildUnsafe();

    await signTx(api, update, sequencer.keyRingPair).then((events) => {
      const eventResponse = getEventResultFromMangataTx(events);
      //this must fail, since no read rights must be avl.
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual("OperationFailed");
    });

    await waitForNBlocks(
      (await Rolldown.disputePeriodLength(chain)).toNumber(),
    );
    const sequencerStatusAfterWaiting = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatusAfterWaiting.readRights.toString()).toBe("1");
    expect(sequencerStatusAfterWaiting.cancelRights.toString()).toBe("1");
  });
  it("An active sequencer with cancel rights can submit cancels", async () => {
    const chain = "Ethereum";
    const sequencer = await setupASequencer(chain);
    const { disputeEndBlockNumber: disputeEndBlockNumber1 } =
      await createAnUpdate(sequencer, chain);
    let sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatus.readRights.toString()).toBe("0");
    expect(sequencerStatus.cancelRights.toString()).toBe("1");

    const api = getApi();
    let cancel = await Sudo.asSudoFinalized(
      Sudo.sudoAs(
        sequencer,
        await Rolldown.cancelRequestFromL1(chain, disputeEndBlockNumber1),
      ),
    );
    const cancelReqId = Rolldown.getRequestIdFromCancelEvent(
      cancel,
      "rolldown",
      "L1ReadCanceled",
    );
    await waitSudoOperationSuccess(cancel, "SudoAsDone");

    sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatus.readRights.toString()).toBe("0");
    expect(sequencerStatus.cancelRights.toString()).toBe("0");

    const idx = await Rolldown.lastProcessedRequestOnL2(chain);
    //since last update was canceled, idx is idx -1.
    const { disputeEndBlockNumber: disputeEndBlockNumber2 } =
      await createAnUpdate(preSetupSequencers.Ethereum, chain, idx - 1);
    cancel = await Sudo.asSudoFinalized(
      Sudo.sudoAs(
        sequencer,
        await Rolldown.cancelRequestFromL1(chain, disputeEndBlockNumber2),
      ),
    );
    await waitSudoOperationFail(
      cancel,
      ["CancelRightsExhausted"],
      "SudoAsDone",
    );

    await Rolldown.waitForReadRights(preSetupSequencers.Ethereum, 50, chain);
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    const cancelResolution = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        preSetupSequencers.Ethereum,
        new L2Update(api)
          .withCancelResolution(txIndex, cancelReqId, false)
          .on(chain)
          .buildUnsafe(),
      ),
    );
    const eventFiltered = filterAndStringifyFirstEvent(
      cancelResolution,
      "L1ReadStored",
    );
    expect(eventFiltered.chain).toEqual(chain);
    expect(eventFiltered.sequencer).toEqual(preSetupSequencers.Ethereum);
    expect(eventFiltered.range.start).toEqual(txIndex.toString());
    expect(eventFiltered.range.end).toEqual(txIndex.toString());
    await waitSudoOperationSuccess(cancelResolution, "SudoAsDone");
    await waitForNBlocks(
      (await Rolldown.disputePeriodLength(chain)).toNumber(),
    );

    sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    // sequencer did the cancel , its not justified -> kicked!
    expect(sequencerStatus.readRights.toString()).toBe("0");
    expect(sequencerStatus.cancelRights.toString()).toBe("0");

    await Rolldown.waitForReadRights(preSetupSequencers.Ethereum, 50, chain);
    const otherSequencerStatus = await Rolldown.sequencerRights(
      chain,
      preSetupSequencers.Ethereum,
    );
    expect(otherSequencerStatus.readRights.toString()).toBe("1");
    //the other sequencer got kicked, this must be zero, since it is the only sequencer
    expect(otherSequencerStatus.cancelRights.toString()).toBe("0");
  });

  //TODO- Add a test when collating is not required.
  it.skip("Max sequencer is set for both chains - fix when BugFix", async () => {
    const maxSequencers = await SequencerStaking.maxSequencers();
    const activeSequencers = await SequencerStaking.activeSequencers();
    const amountForArb =
      (parseInt(maxSequencers.toHuman()) as number) -
      (activeSequencers.toHuman().Arbitrum! as string[]).length;
    for (let i = 0; i < amountForArb; i++) {
      const [user] = setupUsers();
      const tx = await Sudo.batchAsSudoFinalized(
        Assets.mintNative(user),
        Sudo.sudoAs(
          user,
          await SequencerStaking.provideSequencerStaking(BN_ZERO, "Arbitrum"),
        ),
      );
      await waitSudoOperationSuccess(tx, "SudoAsDone");
    }
  });
});
