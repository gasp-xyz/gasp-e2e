/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import "jest-extended";
import { Abi, createWalletClient, http, PrivateKeyAccount } from "viem";
import { testLog } from "../../utils/Logger";
import { waitForBalanceChange } from "../../utils/utils";
import {
  abi,
  ERC20_ADDRESS,
  getAssetIdFromErc20,
  getBalance,
  getL2UpdatesStorage,
  publicClient,
  ROLL_DOWN_CONTRACT_ADDRESS,
  setupEthUser,
} from "../../utils/rollup/ethUtils";
import { EthUser } from "../../utils/EthUser";
import { Keyring } from "@polkadot/api";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { signTxMetamask } from "../../utils/metamask";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { jest } from "@jest/globals";

let user: EthUser;
jest.setTimeout(600000);

async function depositAndWait(depositor: EthUser) {
  const updatesBefore = await getL2UpdatesStorage();
  testLog.getLog().info(JSON.stringify(updatesBefore));
  const acc: PrivateKeyAccount = privateKeyToAccount(
    depositor.privateKey as `0x${string}`,
  );
  const { request } = await publicClient.simulateContract({
    account: acc,
    address: ROLL_DOWN_CONTRACT_ADDRESS,
    abi: abi as Abi,
    functionName: "deposit",
    args: [ERC20_ADDRESS, BigInt(112233445566)],
  });

  const wc = createWalletClient({
    account: acc,
    chain: anvil,
    transport: http(),
  });
  await wc.writeContract(request);

  const updatesAfter = await getL2UpdatesStorage();
  testLog.getLog().info(JSON.stringify(updatesAfter));

  // eslint-disable-next-line no-console
  console.log(updatesAfter);
  // eslint-disable-next-line no-console
  console.log(updatesBefore);
  // TODO: verify that deposit is present in the pendingDeposits in l2update
  //validate that the request got inserted.
  // expect(
  //   parseInt(JSON.parse(JSON.stringify(updatesAfter)).lastAcceptedRequestOnL1),
  // ).toBeGreaterThan(
  //   parseInt(JSON.parse(JSON.stringify(updatesBefore)).lastAcceptedRequestOnL1),
  // );
  testLog.getLog().info(depositor.keyRingPair.address);
  const assetId = await getAssetIdFromErc20();
  // Wait for the balance to change
  return await waitForBalanceChange(depositor.ethAddress, 20, assetId);
}

describe("Rollup", () => {
  describe("Deposits & withdraws", () => {
    beforeEach(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      setupUsers();
      const keyRing = new Keyring({ type: "sr25519" });
      user = new EthUser(keyRing);
      await setupEthUser(
        user,
        ERC20_ADDRESS,
        ROLL_DOWN_CONTRACT_ADDRESS,
        112233445566,
      );
    });

    test("A user who deposits a token will have them on the node", async () => {
      const anyChange = await depositAndWait(user);
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });

    test("withdrawing tokens from the rollup contract", async () => {
      const anyChange = await depositAndWait(user);
      // Check that got updated.
      expect(anyChange).toBeTruthy();

      await Sudo.batchAsSudoFinalized(Assets.mintNative(user));
      const tx = getApi().tx.rolldown.withdraw(
        user.ethAddress,
        ERC20_ADDRESS,
        1122,
      );
      const balanceBefore = await getBalance(ERC20_ADDRESS, user.ethAddress);
      const result = await signTxMetamask(tx, user.ethAddress, user.privateKey);
      const res = getEventResultFromMangataTx(result);
      expect(res).toBeTruthy();

      let balanceAfter = await getBalance(ERC20_ADDRESS, user.ethAddress);
      while (
        BigInt((balanceAfter as any).toString()) <=
        BigInt((balanceBefore as any).toString())
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        balanceAfter = await getBalance(ERC20_ADDRESS, user.ethAddress);
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
