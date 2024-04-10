/*
 *
 * @group rollup
 */
import "jest-extended";
import { PublicClient } from "viem";
import { publicClient } from "../../utils/rollup/ethUtils";
import { jest } from "@jest/globals";
import { testLog } from "../../utils/Logger";
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.setTimeout(600000);
const taskManagerAddress = getEnvironmentRequiredVars().taskManager;

function waitForTaskGenerated(publicClient: PublicClient) {
  return new Promise((resolve, _) => {
    publicClient.watchEvent({
      address: taskManagerAddress,
      event: {
        type: "event",
        name: "NewTaskCreated",
        inputs: [
          {
            name: "taskIndex",
            type: "uint32",
            indexed: true,
            internalType: "uint32",
          },
          {
            name: "task",
            type: "(uint256,uint32,bytes,uint32)",
            indexed: false,
            internalType: "(uint256,uint32,bytes,uint32)",
          },
        ],
        anonymous: false,
      },
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
    publicClient.watchEvent({
      address: taskManagerAddress,
      event: {
        type: "event",
        name: "TaskResponded",
        inputs: [
          {
            name: "taskResponse",
            type: "(uint32,bytes32,bytes32)",
            indexed: false,
            internalType: "(uint32,bytes32,bytes32)",
          },
          {
            name: "taskResponseMetadata",
            type: "(uint32,bytes32,uint96[],uint96[])",
            indexed: false,
            internalType: "(uint32,bytes32,uint96[],uint96[])",
          },
        ],
        anonymous: false,
      },
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
