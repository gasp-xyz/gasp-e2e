/*
 *
 * @group sequencerStaking
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_MILLION, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import {
  expectExtrinsicFail,
  expectExtrinsicSucceed,
  waitForNBlocks,
} from "../../utils/utils";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import {
  ExtrinsicResult,
  waitSudoOperationFail,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

const findACollatorButNotSequencerUser = () => {
  return alice;
};

async function leaveSequencingIfAlreadySequencer(user: User) {
  const stakedEth = await SequencerStaking.sequencerStake(
    user.keyRingPair.address,
    "Ethereum",
  );
  const stakedArb = await SequencerStaking.sequencerStake(
    user.keyRingPair.address,
    "Arbitrum",
  );
  let chain = "";
  if (stakedEth.toHuman() !== "0") {
    chain = "Ethereum";
  } else if (stakedArb.toHuman() !== "0") {
    chain = "Arbitrum";
  }
  if (chain !== "") {
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await signTx(
      await getApi(),
      await SequencerStaking.leaveSequencerStaking(chain as ChainName),
      user.keyRingPair,
    );
    await signTx(
      await getApi(),
      await SequencerStaking.unstake(chain as ChainName),
      user.keyRingPair,
    );
  }
}

async function createAnUpdate(
  seq: User | string,
  chain: ChainName = "Arbitrum",
  forcedIndex = 0,
) {
  const address = typeof seq === "string" ? seq : seq.keyRingPair.address;
  await Rolldown.waitForReadRights(address, 50, chain);
  let txIndex = await Rolldown.l2OriginRequestId();
  if (forcedIndex !== 0) {
    txIndex = forcedIndex;
  }
  const api = getApi();
  const update = new L2Update(api)
    .withDeposit(txIndex, address, address, BN_MILLION)
    .on(chain)
    .build();
  let reqId = 0;
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(address, update),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events, "SudoAsDone");
    reqId = Rolldown.getRequestIdFromEvents(events);
  });
  //await signTx(api, update, seq.keyRingPair).then((events) => {
  //    expectExtrinsicSucceed(events);
  //    reqId = Rolldown.getRequestIdFromEvents(events);
  //  });
  return { txIndex, api, reqId };
}

async function createAnUpdateAndCancelIt(
  seq: User,
  canceler: string,
  chain: ChainName = "Arbitrum",
) {
  const { txIndex, api, reqId } = await createAnUpdate(seq, chain);
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      canceler,
      await Rolldown.cancelRequestFromL1(chain, reqId),
    ),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events, "SudoAsDone");
  });
  return { txIndex, api, reqId };
}

async function setupASequencer(chain: ChainName = "Ethereum") {
  const notYetSequencer = findACollatorButNotSequencerUser();
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

describe("sequencerStaking", () => {
  beforeEach(async () => {
    await initApi();
    setupUsers();
    await setupApi();
    await leaveSequencingIfAlreadySequencer(findACollatorButNotSequencerUser());
    const sequencersBefore = await SequencerStaking.activeSequencers();
    expect(sequencersBefore.toHuman().Ethereum).not.toContain(
      findACollatorButNotSequencerUser().keyRingPair.address,
    );
  });
  it("An already collator joining as sequencer - On Active", async () => {
    const notYetSequencer = await setupASequencer();
    const sequencers = await SequencerStaking.activeSequencers();
    expect(sequencers.toHuman().Ethereum).toContain(
      notYetSequencer.keyRingPair.address,
    );
  });
  it("Active Sequencer - mint less than min amount -> Not in active", async () => {
    const notYetSequencer = findACollatorButNotSequencerUser();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.subn(1234),
        "Ethereum",
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
    const notYetSequencer = findACollatorButNotSequencerUser();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1234),
        "Arbitrum",
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
    await Rolldown.waitForReadRights(seq.keyRingPair.address, 50, "Arbitrum");
    const txIndex = await Rolldown.l2OriginRequestId("Arbitrum");
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        seq.keyRingPair.address,
        seq.keyRingPair.address,
        BN_MILLION,
      )
      .on("Arbitrum")
      .build();
    await signTx(api, update, seq.keyRingPair).then((events) => {
      expectExtrinsicSucceed(events);
    });
    await signTx(
      api,
      await SequencerStaking.leaveSequencerStaking("Arbitrum"),
      seq.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    await signTx(
      api,
      await SequencerStaking.unstake("Arbitrum"),
      seq.keyRingPair,
    ).then((events) => {
      const res = expectExtrinsicFail(events);
      expect(res.data.toString()).toContain(
        "SequencerLastUpdateStillInDisputePeriod",
      );
    });
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await signTx(
      api,
      await SequencerStaking.unstake("Arbitrum"),
      seq.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    const res = await SequencerStaking.sequencerStake(
      seq.keyRingPair.address,
      "Arbitrum",
    );
    expect(res.toHuman()).toBe("0");
  });
  it.todo("Only a selected sequencer can submit updates", async () => {});
  it("Only a selected sequencer with read rights can submit updates", async () => {
    const chain = "Ethereum";
    const sequencer = await setupASequencer();
    await createAnUpdate(sequencer, chain);
    const sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatus.readRights.toString()).toBe("0");
    expect(sequencerStatus.cancelRights.toString()).toBe("1");

    const api = getApi();
    const txIndex = await Rolldown.l2OriginRequestId();
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        sequencer.keyRingPair.address,
        sequencer.keyRingPair.address,
        BN_MILLION,
      )
      .on()
      .build();

    await signTx(api, update, sequencer.keyRingPair).then((events) => {
      const eventResponse = getEventResultFromMangataTx(events);
      //this must fail, since no read rights must be avl.
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual("OperationFailed");
    });

    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    const sequencerStatusAfterWaiting = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatusAfterWaiting.readRights.toString()).toBe("1");
    expect(sequencerStatusAfterWaiting.cancelRights.toString()).toBe("1");
  });
  it.skip("Only an active sequencer with cancel rights can submit cancels - fix when BugFix", async () => {
    const chain = "Ethereum";
    const sequencer = await setupASequencer(chain);
    const { reqId: reqIdCanceled } = await createAnUpdate(sequencer, chain);
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
        await Rolldown.cancelRequestFromL1(chain, reqIdCanceled),
      ),
    );
    await waitSudoOperationSuccess(cancel, "SudoAsDone");

    sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatus.readRights.toString()).toBe("0");
    expect(sequencerStatus.cancelRights.toString()).toBe("0");
    // a user got rid of all his sequencer cancels.

    //createAnUpdateWith: 0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0
    const idx = await Rolldown.l2OriginRequestId();
    //since last update was canceled, idx is idx -1.
    const { reqId } = await createAnUpdate(
      "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
      chain,
      idx - 1,
    );
    cancel = await Sudo.asSudoFinalized(
      Sudo.sudoAs(sequencer, await Rolldown.cancelRequestFromL1(chain, reqId)),
    );
    await waitSudoOperationFail(
      cancel,
      ["CancelRightsExhausted"],
      "SudoAsDone",
    );

    await Rolldown.waitForReadRights(
      "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
      50,
      chain,
    );
    const txIndex = await Rolldown.l2OriginRequestId();
    const cancelResolution = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
        new L2Update(api)
          .withCancelResolution(txIndex - 1, reqIdCanceled, false)
          .on(chain)
          .build(),
      ),
    );
    await waitSudoOperationSuccess(cancelResolution, "SudoAsDone");
    sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatus.readRights.toString()).toBe("0");
    expect(sequencerStatus.cancelRights.toString()).toBe("0");

    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    sequencerStatus = await Rolldown.sequencerRights(
      chain,
      sequencer.keyRingPair.address,
    );
    expect(sequencerStatus.readRights.toString()).toBe("1");
    expect(sequencerStatus.cancelRights.toString()).toBe("1");
  });
  it.skip("Active Sequencer -> Active -> canceled update -> Can not leave - fix when BugFix", async () => {
    const notYetSequencer = findACollatorButNotSequencerUser();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1234),
        "Arbitrum",
      ),
      notYetSequencer.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    const sequencers = await SequencerStaking.activeSequencers();
    expect(sequencers.toHuman().Arbitrum).toContain(
      notYetSequencer.keyRingPair.address,
    );
    const canceler = (sequencers.toHuman().Arbitrum as string[]).filter(
      (x) => x !== notYetSequencer.keyRingPair.address,
    )[0];
    const seq = notYetSequencer;
    const { api, reqId } = await createAnUpdateAndCancelIt(seq, canceler);
    await signTx(
      api,
      await SequencerStaking.leaveSequencerStaking("Arbitrum"),
      seq.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    await signTx(
      api,
      await SequencerStaking.unstake("Arbitrum"),
      seq.keyRingPair,
    ).then((events) => {
      const res = expectExtrinsicFail(events);
      expect(res.data.toString()).toContain(
        "SequencerAwaitingCancelResolution",
      );
    });
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await Rolldown.waitForReadRights(canceler, 50, "Arbitrum");
    const txIndex = await Rolldown.l2OriginRequestId();
    const cancelResolutionEvents = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        canceler,
        new L2Update(api)
          .withCancelResolution(txIndex, reqId, false)
          .on("Arbitrum")
          .build(),
      ),
    );
    await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    //then the user must be able to unstake and leave

    await signTx(
      api,
      await SequencerStaking.unstake("Arbitrum"),
      seq.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    const res = await SequencerStaking.sequencerStake(
      seq.keyRingPair.address,
      "Arbitrum",
    );
    expect(res.toHuman()).toBe("0");
  });
  //TODO - Add test for sequencer creating a cancel and unstake
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
