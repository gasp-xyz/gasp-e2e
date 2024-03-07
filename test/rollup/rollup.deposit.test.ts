/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi } from "../../utils/setup";
import "jest-extended";
import { Abi, createWalletClient, http, PrivateKeyAccount } from "viem";
import { testLog } from "../../utils/Logger";
import { stringToBN, waitForBalanceChange } from "../../utils/utils";
import {
  abi,
  ERC20_ADDRESS,
  getAssetIdFromErc20,
  getL2UpdatesStorage,
  publicClient,
  ROLL_DOWN_CONTRACT_ADDRESS,
  setupEthUser,
} from "../../utils/rollup/ethUtils";
import { EthUser } from "../../utils/EthUser";
import { Keyring } from "@polkadot/api";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

let user: EthUser;

describe("Rollup", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    const keyRing = new Keyring({ type: "sr25519" });
    user = new EthUser(keyRing);
    await setupEthUser(user, ERC20_ADDRESS, ROLL_DOWN_CONTRACT_ADDRESS, 112233);
  });

  describe("Deposits arrive to mangata node", () => {
    test("A user who deposits a token will have them on the node", async () => {
      const updatesBefore = await getL2UpdatesStorage();
      testLog.getLog().info(JSON.stringify(updatesBefore));
      // Set up the request to write in the contract
      const acc: PrivateKeyAccount = privateKeyToAccount(
        user.privateKey as `0x${string}`,
      );
      const { request } = await publicClient.simulateContract({
        account: acc,
        address: ROLL_DOWN_CONTRACT_ADDRESS,
        abi: abi as Abi,
        functionName: "deposit",
        args: [ERC20_ADDRESS, BigInt(112233)],
      });

      const wc = createWalletClient({
        account: acc,
        chain: anvil,
        transport: http(),
      });
      await wc.writeContract(request);

      const updatesAfter = await getL2UpdatesStorage();
      testLog.getLog().info(JSON.stringify(updatesAfter));

      // validate that the request got inserted.
      expect(
        parseInt(
          JSON.parse(JSON.stringify(updatesAfter)).lastAcceptedRequestOnL1,
        ),
      ).toBeGreaterThan(
        parseInt(
          JSON.parse(JSON.stringify(updatesBefore)).lastAcceptedRequestOnL1,
        ),
      );
      testLog.getLog().info(user.pdAccount.keyRingPair.address);
      const assetId = await getAssetIdFromErc20();
      // Wait for the balance to change
      const anyChange = await waitForBalanceChange(
        user.pdAccount.keyRingPair.address,
        20,
        stringToBN(assetId.toHex()),
      );
      // Check that got updated.
      expect(anyChange).toBeTruthy();
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
