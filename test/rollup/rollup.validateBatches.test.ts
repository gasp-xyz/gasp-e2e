/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers, sudo } from "../../utils/setup";
import "jest-extended";
import { testLog } from "../../utils/Logger";
import { stringToBN } from "../../utils/utils";
import {
  depositAndWait,
  getAssetIdFromErc20,
  getBalance,
  getPublicClient,
  setupEthUser,
  waitForNClosedWithdrawals,
} from "../../utils/rollup/ethUtils";
import { Sudo } from "../../utils/sudo";
import { jest } from "@jest/globals";
import { Rolldown } from "../../utils/rollDown/Rolldown";
import { getL1 } from "../../utils/rollup/l1s";
import { Assets } from "../../utils/Assets";
import { User } from "../../utils/User";
import { SubmittableExtrinsic } from "@polkadot/api/types";
jest.setTimeout(6000000000);

let testUser: User;
let testUser2: User;
describe("Rollup", () => {
  describe("Batching:", () => {
    beforeEach(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      [testUser, testUser2] = setupUsers();
      const params = getL1("EthAnvil");
      await setupEthUser(
        testUser,
        params?.contracts.dummyErc20.address!,
        params?.contracts.rollDown.address!,
        112233445566,
      );
    });

    test("Create withdraw batches from 0...1000 and validate they executed correctly", async () => {
      await depositAndWait(testUser, "EthAnvil", true);
      const tokenAddress = getL1("EthAnvil")?.contracts.dummyErc20.address!;
      await sudo.registerL1Asset(null, tokenAddress, "Ethereum");
      const tokenId = await getAssetIdFromErc20(tokenAddress, "EthAnvil");
      await Sudo.batchAsSudoFinalized(Assets.mintToken(tokenId, testUser2));
      const ethBalanceBefore = (await getBalance(
        tokenAddress,
        testUser2.keyRingPair.address,
        "EthAnvil",
      )) as any;
      let expectedTokens = 0;
      let alltxs: SubmittableExtrinsic<any>[] = [];
      for (let i = 1; i < 100; i++) {
        const txs = await Rolldown.createWithdrawalTxs(
          i,
          "EthAnvil",
          testUser2.keyRingPair.address,
          tokenAddress,
        );

        const manualBatchTx = await Rolldown.createManualBatch("EthAnvil");
        txs.push(manualBatchTx);
        alltxs = alltxs.concat(txs);
        expectedTokens += i;
        //if (i % 20 === 0) {
        await Sudo.batchAsSudoFinalized(...alltxs);
        alltxs = [];
        await waitForNClosedWithdrawals(getPublicClient("EthAnvil"), i);
        //}
      }

      await waitForNClosedWithdrawals(getPublicClient("EthAnvil"), 1000);
      const ethBalanceAfter = (await getBalance(
        tokenAddress,
        testUser2.keyRingPair.address,
        "EthAnvil",
      )) as any;
      testLog
        .getLog()
        .info("**** balance Before:: " + ethBalanceBefore.toString());
      testLog
        .getLog()
        .info("**** balance After:: " + ethBalanceAfter.toString());
      expect(stringToBN(ethBalanceAfter.toString())).bnEqual(
        stringToBN(ethBalanceBefore.toString()).addn(expectedTokens),
      );
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
