//Example: ts-node performance/index.ts
//Options:
// run transfer

//npx ts-node ./performance/index.ts transfer threadNumber=3 testCaseName=transfer duration=1000 totalTransactions=25000 nodes=ws://ws1,ws://ws2

import {TestParams} from "./testParams";
import {Tests, TestFactory} from "./testFactory";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArguments = args.slice(1);
  switch (command) {
    case "transfer":
      const testParams = new TestParams();
      commandArguments.forEach((commandArgument: string) => {
        const [arg, value] = commandArgument.split("=");
        switch (arg) {
          case "threadNumber":
            testParams.threads = parseInt(value);
            break;
          case "testCaseName":
            switch (value) {
              case "transfer":
              case "mint":
              case "burn":
              case "swap":
                testParams.testCaseName = value;
                break;
              default:
                throw new Error(`Unknown testCaseName: ${value}`);
            }
            break;
          case "duration":
            testParams.duration = parseInt(value);
            break;
          case "totalTransactions":
            testParams.totalTx = parseInt(value);
            break;
          case "nodes":
            const nodes = value.split(",");
            testParams.nodes = [];
            nodes.forEach((node: string) => {
              testParams.nodes.push(node);
            });
            break;
          default:
            throw new Error(`Unknown argument: ${value}`);
        }
      });
      verifyArgs(testParams, "transfer"); // Will throw an error if invalid args
      await runExtrinsicTransfer(testParams);
      break;

    default:
      throw new Error(`Invalid command: ${command}`);
  }
}

function verifyArgs(params: TestParams, test: string) {
  switch (test) {
    case "Transfer":
      if (
        params.threads == null ||
        params.testCaseName == null ||
        params.duration == null ||
        params.nodes == null ||
        params.totalTx == null
      ) {
        throw new Error(`You must pass in the following arugments:
        threadNumber: number
        testCaseName: transfer | mint | burn | swap
        duration: number
        totalTransactions: number
        nodes: string (web socket url, ws://foobar...)`);
      }

      if (params.threads <= 0 || params.threads > 10) {
        throw new Error(`threadNumber must be between 1 and 10`);
      }

      if (!["transfer", "mint", "burn", "swap"].includes(params.testCaseName)) {
        throw new Error(
          `testCaseName must be either transfer, mint, burn, or swap`
        );
      }

      if (params.duration <= 0 || params.duration > 10000) {
        throw new Error(`duration must be between 1 and 10000`);
      }

      if (params.totalTx <= 0 || params.totalTx > 100000) {
        throw new Error(`totalTransactions must be between 1 and 100000`);
      }

      const reWs = new RegExp(
        "/^(ws?://)([0-9]{1,3}(?:.[0-9]{1,3}){3}|[a-zA-Z]+):([0-9]{1,5})$/"
      );
      const reWss = new RegExp(
        "/^(wss?://)([0-9]{1,3}(?:.[0-9]{1,3}){3}|[a-zA-Z]+):([0-9]{1,5})$/"
      );

      params.nodes.forEach((node) => {
        if (!(reWs.test(node) || reWss.test(node))) {
          throw new Error(
            `Invalid node url. You must use a valid websocket endpoint.`
          );
        }
      });

      break;

    default:
      break;
  }
}

export async function runExtrinsicTransfer(params: TestParams) {
  await TestFactory.BuildTestItem(Tests.ExtrinsicTransfer).run(params);
}
export async function runExtrinsicSwap(params: TestParams) {
  await TestFactory.BuildTestItem(Tests.Swap).run(params);
}

main();
