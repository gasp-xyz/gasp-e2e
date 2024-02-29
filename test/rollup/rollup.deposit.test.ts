/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi } from "../../utils/setup";
import "jest-extended";
import { Abi } from "viem";
import { testLog } from "../../utils/Logger";
import { stringToBN, waitForBalanceChange } from "../../utils/utils";
import {
  abi,
  account,
  convertEthAddressToDotAddress,
  ERC20_ADDRESS,
  getL2UpdatesStorage,
  publicClient,
  ROLL_DOWN_CONTRACT_ADDRESS,
  walletClient
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
        13,
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
