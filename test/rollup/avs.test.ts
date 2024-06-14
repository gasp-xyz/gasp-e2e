/*
 *
 */
import "jest-extended";
import { PublicClient } from "viem";
import { jest } from "@jest/globals";
import { testLog } from "../../utils/Logger";

// @ts-ignore
import finalizerTaskManager from "./abis/FinalizerTaskManager.json";
import { getPublicClient } from "../../utils/rollup/ethUtils";

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
      await waitForTaskGenerated(getPublicClient("EthAnvil"));
    });
    test("Aggregator & Finalizer - Responses are written in aws", async () => {
      await waitForTaskResponded(getPublicClient("EthAnvil"));
    });
  });
});

// @ts-ignore
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};
