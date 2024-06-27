/*
 *
 * @group rollupUpdate
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_MILLION, signTx } from "@mangata-finance/sdk";
import { getApi, initApi } from "../../utils/api";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import {
  expectExtrinsicFail,
  expectExtrinsicSucceed,
  waitForNBlocks,
} from "../../utils/utils";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";

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
    const notYetSequencer = findACollatorButNotSequencerUser();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1234),
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
    const txIndex = await Rolldown.l2OriginRequestId();
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
  it.skip("Active Sequencer -> Active -> canceled update -> Can not leave", async () => {
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
    await Rolldown.waitForReadRights(seq.keyRingPair.address, 50, "Arbitrum");
    let txIndex = await Rolldown.l2OriginRequestId();
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
    let reqId = 0;
    await signTx(api, update, seq.keyRingPair).then((events) => {
      expectExtrinsicSucceed(events);
      reqId = Rolldown.getRequestIdFromEvents(events);
    });
    await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        canceler,
        await Rolldown.cancelRequestFromL1("Arbitrum", reqId),
      ),
    ).then(async (events) => {
      await waitSudoOperationSuccess(events, "SudoAsDone");
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
        "SequencerAwaitingCancelResolution",
      );
    });
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await Rolldown.waitForReadRights(canceler, 50, "Arbitrum");
    txIndex = await Rolldown.l2OriginRequestId();
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
  it.skip("Max sequencer is set for both chains", async () => {
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
