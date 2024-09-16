/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import "jest-extended";
import { testLog } from "../../utils/Logger";
import {
  depositAndWait,
  getBalance,
  setupEthUser,
} from "../../utils/rollup/ethUtils";
import { Keyring } from "@polkadot/api";
import { signTxMetamask } from "../../utils/metamask";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { jest } from "@jest/globals";
import { User } from "../../utils/User";
import { getL1 } from "../../utils/rollup/l1s";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { signTx } from "gasp-sdk";

let user: User;
jest.setTimeout(600000);

describe("Rollup", () => {
  describe("ETH Deposits & withdraws", () => {
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
      const params = getL1("EthAnvil");
      await setupEthUser(
        user,
        params?.contracts.dummyErc20.address!,
        params?.contracts.rollDown.address!,
        112233445566,
      );
    });

    test("A sequencer who creates a fake deposit, is slashed", async () => {
      const newSequencer = user;
      const events = await signTx(
        await getApi(),
        await SequencerStaking.provideSequencerStaking(),
        newSequencer.keyRingPair,
      );

    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
