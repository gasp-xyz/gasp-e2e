/*
 *
 * @group rollup
 */
import { getApi, initApi } from "../../utils/api";
import { alice, setupApi, setupUsers } from "../../utils/setup";
import "jest-extended";
import { testLog } from "../../utils/Logger";
import { stringToBN, waitForNBlocks } from "../../utils/utils";
import { getBalance } from "../../utils/rollup/ethUtils";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { jest } from "@jest/globals";
import { Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_ZERO } from "gasp-sdk";

jest.setTimeout(600000);

describe("Rollup", () => {
  describe("Batching:", () => {
    beforeEach(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      setupUsers();
    });

    test("Create withdraw batches from 0...1000 and validate they executed correctly", async () => {
      const tokenAddress = await Assets.getAssetAddress(BN_ZERO);
      const ethBalanceBefore = (await getBalance(
        tokenAddress,
        alice.keyRingPair.address,
        "EthAnvil",
      )) as any;
      let expectedTokens = 1;
      for (let i = 0; i < 10; i++) {
        const txs = await Rolldown.createWithdrawalTxs(
          i,
          "EthAnvil",
          alice.keyRingPair.address,
          tokenAddress,
        );
        const manualWithdrawalTx = await Rolldown.createManualBatch("EthAnvil");
        await Sudo.batchAsSudoFinalized(...txs, manualWithdrawalTx);
        expectedTokens += i;
      }
      await waitForNBlocks(10);
      const ethBalanceAfter = (await getBalance(
        tokenAddress,
        alice.keyRingPair.address,
        "EthAnvil",
      )) as any;
      testLog
        .getLog()
        .info("**** balance Before:: " + ethBalanceBefore.toString());
      testLog
        .getLog()
        .info("**** balance Before:: " + ethBalanceAfter.toString());
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
