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
import { setupApi, setupUsers } from "../../utils/setup";
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
import BN from "bn.js";

async function findACollatorButNotSequencerUser() {
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

async function createAnUpdate(
  seq: User | string,
  chain: ChainName = "Arbitrum",
  forcedIndex = 0,
) {
  const address = typeof seq === "string" ? seq : seq.keyRingPair.address;
  await Rolldown.waitForReadRights(address, 50, chain);
  let txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
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
  const cancel = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      canceler,
      await Rolldown.cancelRequestFromL1(chain, reqId),
    ),
  );
  await waitSudoOperationSuccess(cancel, "SudoAsDone");
  const reqIdCanceled = Rolldown.getRequestIdFromCancelEvent(cancel);
  return { txIndex, api, reqId, reqIdCanceled };
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
    const activeSequencers = await SequencerStaking.activeSequencers();
    let anysequencerGone = false;
    for (const chain in activeSequencers.toHuman()) {
      for (const seq of activeSequencers.toHuman()[chain] as string[]) {
        if (
          seq !== preSetupSequencers.Ethereum &&
          seq !== preSetupSequencers.Arbitrum
        ) {
          await leaveSequencingIfAlreadySequencer(seq);
          anysequencerGone = true;
        }
      }
    }
    if (anysequencerGone) {
      await waitForNBlocks(10);
    }
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
    const notYetSequencer = await findACollatorButNotSequencerUser();
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
    const txIndex = await Rolldown.lastProcessedRequestOnL2("Arbitrum");
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
      .build();

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
    });
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
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
  it("An active sequencer with cancel rights can submit cancels", async () => {
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
    const { reqId } = await createAnUpdate(
      preSetupSequencers.Ethereum,
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

    await Rolldown.waitForReadRights(preSetupSequencers.Ethereum, 50, chain);
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    const cancelResolution = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        preSetupSequencers.Ethereum,
        new L2Update(api)
          .withCancelResolution(txIndex, cancelReqId, false)
          .on(chain)
          .build(),
      ),
    );
    await waitSudoOperationSuccess(cancelResolution, "SudoAsDone");
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());

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
  it("Active Sequencer -> Active -> canceled update -> Can not leave", async () => {
    const chain = "Arbitrum";
    const notYetSequencer = await findACollatorButNotSequencerUser();
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
    const canceler = preSetupSequencers.Arbitrum;
    const seq = notYetSequencer;
    const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
      seq,
      canceler,
      chain,
    );
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
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    const cancelResolutionEvents = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        canceler,
        new L2Update(api)
          .withCancelResolution(txIndex, reqIdCanceled, false)
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