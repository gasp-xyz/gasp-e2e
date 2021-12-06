//Example: ts-node performance/index.ts
//Options:
// run transfer

//npx ts-node ./performance/index.ts transfer threadNumber=3 testCaseName=transfer duration=1000 totalTransactions=25000 nodes=ws://ws1,ws://ws2

import { TestParams } from "./testParams";
import { Tests, TestFactory } from "./testFactory";

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
      await runExtrinsicTransfer(testParams);
      break;
    default:
      throw new Error(`Invalid command: ${command}`);
  }
}

async function runExtrinsicTransfer(params: TestParams) {
  await TestFactory.BuildTestItem(Tests.ExtrinsicTransfer).run(params);
}

main();
