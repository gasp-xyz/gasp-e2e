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
  waitForBatchWithRequest,
} from "../../utils/rollup/ethUtils";
import { Keyring } from "@polkadot/api";
import { signTxMetamask } from "../../utils/metamask";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { jest } from "@jest/globals";
import { User } from "../../utils/User";
import { getL1 } from "../../utils/rollup/l1s";
import { Rolldown } from "../../utils/rollDown/Rolldown";
import { nToBigInt } from "@polkadot/util";
import { closeL1Item } from "../../utils/setupsOnTheGo";

let user: User;
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
      await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
    });

    test("A user who deposits a token ferried will have them on the node soonish", async () => {
      const anyChange = await depositAndWait(user, "EthAnvil", false, true);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });

    test.skip("withdrawing tokens from the rollup contract", async () => {
      const anyChange = await depositAndWait(user);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
      const erc20Address = getL1("EthAnvil")?.contracts.dummyErc20.address!;
      await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
      const tx = getApi().tx.rolldown.withdraw(
        "Ethereum",
        user.keyRingPair.address,
        erc20Address,
        1122,
        null,
      );
      const balanceBefore = await getBalance(
        erc20Address,
        user.keyRingPair.address,
        "EthAnvil",
      );
      const result = await signTxMetamask(
        tx,
        user.keyRingPair.address,
        user.name as string,
      );
      const res = getEventResultFromMangataTx(result);
      expect(res).toBeTruthy();

      let balanceAfter = await getBalance(
        erc20Address,
        user.keyRingPair.address,
        "EthAnvil",
      );
      while (
        BigInt((balanceAfter as any).toString()) <=
        BigInt((balanceBefore as any).toString())
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        balanceAfter = await getBalance(
          erc20Address,
          user.keyRingPair.address,
          "EthAnvil",
        );
        testLog.getLog().info(balanceAfter);
      }
      const diff =
        BigInt((balanceAfter as any).toString()) -
        BigInt((balanceBefore as any).toString());
      expect(diff).toBe(BigInt(1122));
    });
  });
  describe.skip("ARB Deposits & withdraws", () => {
    beforeEach(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      [user] = setupUsers();
      const keyRing = new Keyring({ type: "ethereum" });
      const params = getL1("ArbAnvil");
      user = new User(keyRing);
      await setupEthUser(
        user,
        params?.contracts.dummyErc20.address!,
        params?.contracts.rollDown.address!,
        112233445566,
        "ArbAnvil",
      );
    });

    test("A user who deposits a token will have them on the node", async () => {
      const anyChange = await depositAndWait(user, "ArbAnvil");
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });

    test("withdrawing tokens from the rollup contract", async () => {
      const anyChange = await depositAndWait(user, "ArbAnvil");
      // Check that got updated.
      expect(anyChange).toBeTruthy();
      const arbErc20 = getL1("ArbAnvil")?.contracts.dummyErc20.address!;
      await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
      const tx = getApi().tx.rolldown.withdraw(
        "Arbitrum",
        user.keyRingPair.address,
        arbErc20,
        1122,
        null,
      );

      const balanceBefore = await getBalance(
        arbErc20,
        user.keyRingPair.address,
        "ArbAnvil",
      );
      const result = await signTxMetamask(
        tx,
        user.keyRingPair.address,
        user.name as string,
      );
      const res = getEventResultFromMangataTx(result);
      expect(res).toBeTruthy();
      await signTxMetamask(
        await Rolldown.createManualBatch("ArbAnvil"),
        user.keyRingPair.address,
        user.name as string,
      );
      const requestId = nToBigInt(Rolldown.getUpdateIdFromEvents(result));
      //wait for the update to be in contract
      await waitForBatchWithRequest(requestId, getL1("ArbAnvil")!);
      //run close.
      await closeL1Item(
        requestId,
        "close_withdrawal",
        getL1("ArbAnvil")!.gaspName,
      );

      let balanceAfter = await getBalance(
        arbErc20,
        user.keyRingPair.address,
        "ArbAnvil",
      );
      while (
        BigInt((balanceAfter as any).toString()) <=
        BigInt((balanceBefore as any).toString())
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        balanceAfter = await getBalance(
          arbErc20,
          user.keyRingPair.address,
          "ArbAnvil",
        );
        testLog.getLog().info(balanceAfter);
      }
      const diff =
        BigInt((balanceAfter as any).toString()) -
        BigInt((balanceBefore as any).toString());
      expect(diff).toBe(BigInt(1122));
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
