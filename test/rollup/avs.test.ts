/*
 *
 * @group rollup
 */
import "jest-extended";
import { PublicClient } from "viem";
import { publicClient } from "../../utils/rollup/ethUtils";
import { jest } from "@jest/globals";
import { testLog } from "../../utils/Logger";

// @ts-ignore
import finalizerTaskManager from "./abis/FinalizerTaskManager.json";

jest.setTimeout(600000);
const taskManagerAddress = "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8";

function waitForTaskGenerated(publicClient: PublicClient) {
  return new Promise((resolve, _) => {
    publicClient.watchContractEvent({
      abi: finalizerTaskManager.abi,
      address: taskManagerAddress,
      eventName: "NewTaskCreated",
      onLogs: async (logs) => {
        for (const log of logs) {
          // @ts-ignore
          const taskIndex: number = log.args.taskIndex;
          testLog.getLog().info(JSON.stringify(log));
          resolve(taskIndex);
        }
      },
    });
  });
}

function waitForTaskResponded(publicClient: PublicClient) {
  return new Promise((resolve, _) => {
    publicClient.watchContractEvent({
      abi: finalizerTaskManager.abi,
      address: taskManagerAddress,
      eventName: "TaskResponded",
      onLogs: async (logs) => {
        for (const log of logs) {
          // @ts-ignore
          testLog.getLog().info(JSON.stringify(log));
          resolve(log);
        }
      },
    });
  });
}

describe("Rollup", () => {
  describe("AVS", () => {
    beforeEach(async () => {});

    test("Aggregator - Tasks are generated", async () => {
      await waitForTaskGenerated(publicClient);
    });
    test("Aggregator & Finalizer - Responses are written in aws", async () => {
      await waitForTaskResponded(publicClient);
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
