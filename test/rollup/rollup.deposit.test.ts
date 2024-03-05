/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi } from "../../utils/setup";
import "jest-extended";
import { Abi } from "viem";
import { logEvent, testLog } from "../../utils/Logger";
import { stringToBN, waitForBalanceChange } from "../../utils/utils";
import {
  abi,
  account,
  convertEthAddressToDotAddress,
  ERC20_ADDRESS,
  getL2UpdatesStorage,
  publicClient,
  ROLL_DOWN_CONTRACT_ADDRESS,
  walletClient,
} from "../../utils/rollup/ethUtils";

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
  });

  describe("Deposits arrive to mangata node", () => {
    test("A user who deposits a token will have them on the node", async () => {
      let maxBlocks = 40;
      let allGood = false;
      const p = new Promise(async (resolve, reject) => {
        const api = getApi();
        const unsub = await api.rpc.chain.subscribeFinalizedHeads(
          async (head) => {
            const events = await (
              await api.at(head.hash)
            ).query.system.events();
            maxBlocks--;
            testLog.getLog().info(`-> attempt ${maxBlocks}, head ${head.hash}`);
            events.forEach((e) => logEvent(api.runtimeChain, e));

            if (maxBlocks < 0) {
              reject(`TimedOut!`);
            }
            if (allGood) {
              unsub();
              resolve(true);
            }
          },
        );
      });

      const updatesBefore = await getL2UpdatesStorage();
      testLog.getLog().info(JSON.stringify(updatesBefore));
      // Set up the request to write in the contract
      const { request } = await publicClient.simulateContract({
        account,
        address: ROLL_DOWN_CONTRACT_ADDRESS,
        abi: abi as Abi,
        functionName: "deposit",
        args: [ERC20_ADDRESS, BigInt(12345)],
        gasPrice: BigInt(100000000000000),
        gas: BigInt(1000000),
      });
      await walletClient.writeContract(request);

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
      const dotAddress = convertEthAddressToDotAddress(account.address);
      testLog.getLog().info(dotAddress);
      const param = {
        Ethereum: ERC20_ADDRESS,
      };
      const assetId = await getApi().query.assetRegistry.l1AssetToId(param);

      // Wait for the balance to change
      const anyChange = await waitForBalanceChange(
        dotAddress,
        20,
        stringToBN(assetId.toHex()),
      );
      // Check that got updated.
      expect(anyChange).toBeTruthy();
      allGood = true;
      await Promise.all([p]);
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
