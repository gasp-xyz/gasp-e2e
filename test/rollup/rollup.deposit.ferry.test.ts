/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import "jest-extended";
import {
  depositAndWait,
  depositAndWaitNative,
  setBalance,
  setupEthUser,
} from "../../utils/rollup/ethUtils";
import { Keyring } from "@polkadot/api";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { jest } from "@jest/globals";
import { User } from "../../utils/User";
import { getL1 } from "../../utils/rollup/l1s";

let user: User;
let user2: User;
jest.setTimeout(600000);

describe("Rollup-Ferry", () => {
  describe("ETH Deposits & withdraws", () => {
    beforeEach(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      [user, user2] = setupUsers();
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

    test("A user who deposits a token ferried will have them on the node soonish - eth erc20", async () => {
      const anyChange = await depositAndWait(user, "EthAnvil", false, true);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });

    test("A user who deposits a token ferried will have them on the node soonish- arb Native", async () => {
      await setBalance(user2.keyRingPair.address, 10e18, "ArbAnvil");
      await Sudo.batchAsSudoFinalized(Assets.mintNative(user2));
      const anyChange = await depositAndWaitNative(user2, "ArbAnvil", true);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
