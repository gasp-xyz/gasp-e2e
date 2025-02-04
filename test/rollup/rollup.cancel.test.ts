/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import "jest-extended";
import { Keyring } from "@polkadot/api";
import { jest } from "@jest/globals";
import { User } from "../../utils/User";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { MangataGenericEvent, signTx } from "gasp-sdk";
import { createAnUpdate, Rolldown } from "../../utils/rollDown/Rolldown";
import {
  waitForEvents,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { nToBigInt } from "@polkadot/util";
import { waitForBatchWithRequest } from "../../utils/rollup/ethUtils";
import { getL1 } from "../../utils/rollup/l1s";

let user: User;
jest.setTimeout(600000);

describe("Rollup", () => {
  describe("Sequencer monitors updates O_o", () => {
    beforeEach(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      [user] = setupUsers();
      const keyRing = new Keyring({ type: "ethereum" });
      user = new User(keyRing);
      await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
    });

    test("A sequencer who creates a fake deposit, gets slashed", async () => {
      const newSequencer = user;
      await Sudo.batchAsSudoFinalized(
        await SequencerStaking.provideSequencerStaking(
          newSequencer.keyRingPair.address,
          (await SequencerStaking.minimalStakeAmount()).addn(1000),
        ),
      ).then(async (events) => {
        await waitSudoOperationSuccess(events);
      });

      await Rolldown.waitForReadRights(newSequencer.keyRingPair.address);
      await createAnUpdate(newSequencer, "Ethereum");
      const events = await waitForEvents(
        getApi(),
        "rolldown.L1ReadCanceled",
        30,
      );
      const id = Rolldown.getRequestIdFromCancelEvent(
        events as unknown as MangataGenericEvent[],
      );
      await signTx(
        getApi(),
        await Rolldown.createManualBatch("EthAnvil"),
        newSequencer.keyRingPair,
      );
      //wait for the update to be in contract
      await waitForBatchWithRequest(nToBigInt(id), getL1("EthAnvil")!);

      // FIXME: sequencer should close cancel automatically so maybe instead
      // test should wait for that to happen on L1 ?
      //
      // await Rolldown.closeCancelOnL1(
      //   nToBigInt(id),
      //   getL1("EthAnvil")!.gaspName,
      // );

      await waitForEvents(
        await getApi(),
        "sequencerStaking.SequencersRemovedFromActiveSet",
        40,
      );
      expect(
        (await SequencerStaking.activeSequencers()).toHuman().Ethereum,
      ).not.toContain(newSequencer.keyRingPair.address);
      expect(
        (await SequencerStaking.activeSequencers()).toHuman().Ethereum,
      ).toHaveLength(1);
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
