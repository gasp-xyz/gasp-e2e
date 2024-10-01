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
  getBalance,
  getNativeBalance,
  setupEthUser,
} from "../../utils/rollup/ethUtils";
import { Keyring } from "@polkadot/api";
import { signTxMetamask } from "../../utils/metamask";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { jest } from "@jest/globals";
import { User } from "../../utils/User";
import { getL1 } from "../../utils/rollup/l1s";
import { Rolldown } from "../../utils/rollDown/Rolldown";
import { nToBigInt } from "@polkadot/util";
import BN from "bn.js";
import { signTx } from "gasp-sdk";

let user: User;
let l1Ferrier: User;
jest.setTimeout(600000);

describe("Rollup-Ferry", () => {
  describe("Ferry Deposits", () => {
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
      const params2 = getL1("ArbAnvil");
      await setupEthUser(
        user,
        params2?.contracts.dummyErc20.address!,
        params2?.contracts.rollDown.address!,
        112233445566,
        "ArbAnvil",
      );
      await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
    });
    test("A user who deposits a token ferried will have them on the node soonish - eth erc20", async () => {
      const anyChange = await depositAndWait(user, "EthAnvil", false, true);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });
    test("A user who deposits a token ferried will have them on the node soonish- arb Native", async () => {
      const anyChange = await depositAndWaitNative(user, "ArbAnvil", true);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });
  });
  describe("Ferry withdraws", () => {
    beforeEach(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      [user, l1Ferrier] = setupUsers();
      const keyRing = new Keyring({ type: "ethereum" });
      user = new User(keyRing);
      const params = getL1("EthAnvil");
      await setupEthUser(
        user,
        params?.contracts.dummyErc20.address!,
        params?.contracts.rollDown.address!,
        112233445566,
      );
      await setupEthUser(
        l1Ferrier,
        params?.contracts.dummyErc20.address!,
        params?.contracts.rollDown.address!,
        112233445566,
      );
      await Sudo.batchAsSudoFinalized(
        Assets.mintNative(user),
        Assets.mintNative(l1Ferrier),
      );
    });
    test("A user who deposits a ferried native token Can ferry-withdraw", async () => {
      const l1 = "EthAnvil";
      const tokenAddress = getL1(l1)?.contracts.native.address as "0x${string}";
      const anyChange = await depositAndWaitNative(user, l1, true);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
      //now withdrawing!
      const events = await signTx(
        getApi(),
        Rolldown.withdraw(
          l1,
          user.keyRingPair.address,
          tokenAddress,
          new BN("11223344"),
          668,
        ),
        user.keyRingPair,
      );
      await signTxMetamask(
        await Rolldown.createManualBatch(l1),
        user.keyRingPair.address,
        user.name as string,
      );
      const withdrawal = Rolldown.getUpdateIdFromEvents(events);

      const balanceBefore = await getNativeBalance(user, l1);
      const ferrierBefore = await getNativeBalance(l1Ferrier, l1);
      await Rolldown.ferryWithdrawal(
        l1,
        l1Ferrier,
        user,
        tokenAddress,
        11223344,
        668,
        {
          origin: 1,
          id: nToBigInt(withdrawal.toNumber()),
        },
      );
      const balanceAfter = await getNativeBalance(user, l1);
      const ferrierAfter = await getNativeBalance(l1Ferrier, l1);

      const diff =
        BigInt((balanceAfter as any).toString()) -
        BigInt((balanceBefore as any).toString());

      expect(diff).toBe(BigInt(11223344 - 668));

      const diffFerry =
        BigInt((ferrierBefore as any).toString()) -
        BigInt((ferrierAfter as any).toString());
      expect(diffFerry).toBe(BigInt(11223344 - 668));
    });
    test("A user who deposits a ferried erc20 token Can ferry-withdraw", async () => {
      const l1 = "EthAnvil";
      const tokenAddress = getL1(l1)?.contracts.dummyErc20
        .address as "0x${string}";
      const anyChange = await depositAndWait(user, l1, false, true);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
      //now withdrawing!
      const events = await signTx(
        getApi(),
        Rolldown.withdraw(
          l1,
          user.keyRingPair.address,
          tokenAddress,
          new BN("11223344"),
          668,
        ),
        user.keyRingPair,
      );
      await signTxMetamask(
        await Rolldown.createManualBatch(l1),
        user.keyRingPair.address,
        user.name as string,
      );
      const withdrawal = Rolldown.getUpdateIdFromEvents(events);

      const balanceBefore = await getBalance(
        tokenAddress,
        user.keyRingPair.address,
        l1,
      );
      const ferrierBefore = await getBalance(
        tokenAddress,
        l1Ferrier.keyRingPair.address,
        l1,
      );
      await Rolldown.ferryWithdrawal(
        l1,
        l1Ferrier,
        user,
        tokenAddress,
        11223344,
        668,
        {
          origin: 1,
          id: nToBigInt(withdrawal.toNumber()),
        },
      );
      const balanceAfter = await getBalance(
        tokenAddress,
        user.keyRingPair.address,
        l1,
      );
      const ferrierAfter = await getBalance(
        tokenAddress,
        l1Ferrier.keyRingPair.address,
        l1,
      );

      const diff =
        BigInt((balanceAfter as any).toString()) -
        BigInt((balanceBefore as any).toString());

      expect(diff).toBe(BigInt(11223344 - 668));

      const diffFerry =
        BigInt((ferrierBefore as any).toString()) -
        BigInt((ferrierAfter as any).toString());
      expect(diffFerry).toBe(BigInt(11223344 - 668));
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
