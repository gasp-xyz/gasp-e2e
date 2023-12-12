//Example: ts-node performance/index.ts
//Options:
// run transfer

//npx ts-node ./performance/index.ts threadNumber=3 testCaseName=transfer duration=1000 totalTransactions=25000 nodes=ws://ws1,ws://ws2

import { TestParams } from "./testParams";
import { Commands, TestFactory, TestsCases } from "./testFactory";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArguments = args.slice(1);
  const testParams = new TestParams();
  commandArguments.forEach((commandArgument: string) => {
    const [arg, value] = commandArgument.split("=");
    switch (arg) {
      case "pending": //How many txs should be available all the time in mempool for node to collect throughput - expected number of processed txs in each block (on avarage)
        testParams.pending = parseInt(value);
        break;
      case "throughput":
        testParams.throughput = parseInt(value);
        break;
      case "threadNumber":
        testParams.threads = parseInt(value);
        break;
      case "testCaseName":
        switch (value) {
          case "ConcurrentTest":
            testParams.testCase = TestsCases.ConcurrentTest;
            break;
          case "Burst":
            testParams.testCase = TestsCases.Burst;
            break;
          default:
            throw new Error(
              `Unknown testCaseName: ${value}: Expected: any of[ConcurrentTest,SustainedLoadTest,Rampup,Burst]`,
            );
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
          if (node.length > 0) {
            testParams.nodes.push(node);
          }
        });
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  });
  switch (command) {
    case "transfer":
      testParams.command = Commands.ExtrinsicTransfer;
      break;
    case "transferKA":
      testParams.command = Commands.ExtrinsicTransferKeepAlive;
      break;
    case "transferAll":
      testParams.command = Commands.ExtrinsicTransferAll;
      break;
    case "burn":
      testParams.command = Commands.Burn;
      break;
    case "sell":
      testParams.command = Commands.SwapSell;
      break;
    case "buy":
      testParams.command = Commands.SwapBuy;
      break;
    case "mint":
      testParams.command = Commands.Mint;
      break;
    case "batch":
      testParams.command = Commands.ExtrinsicBatch;
      break;
    case "ping":
      testParams.command = Commands.Ping;
      break;
    case "schedule3rdParty":
      testParams.command = Commands.Schedule3rdParty;
      break;
    case "claim3rdParty":
      testParams.command = Commands.Claim3rdParty;
      break;
    case "scheduleActivate3rdParty":
      testParams.command = Commands.ScheduleActivate3rdParty;
      break;
    default:
      throw new Error(
        `Unknown command: ${command}, available: "transfer", "mint", "burn", "swap"`,
      );
  }
  verifyArgs(testParams, "transfer"); // Will throw an error if invalid args
  return TestFactory.BuildTestItem(testParams.command!).run(testParams);
}

function verifyArgs(params: TestParams, test: string) {
  if (
    params.threads == null ||
    params.testCase == null ||
    params.duration == null ||
    params.nodes == null ||
    params.totalTx == null ||
    test == null
  ) {
    throw new Error(`You must pass in the following arugments:
        threadNumber: number
        testCaseName: transfer | mint | burn | swap
        duration: number
        totalTransactions: number
        nodes: string (web socket url, ws://foobar...)`);
  }

  if (params.threads <= 0) {
    throw new Error(`threadNumber must be between > 0`);
  }

  if (params.testCase === undefined) {
    throw new Error(`testCaseName must be either ConcurrentTest, Rampup`);
  }

  if (params.duration <= 0 || params.duration > 10000) {
    throw new Error(`duration in minutes must be between 1 and 10000`);
  }

  if (params.totalTx <= 0) {
    throw new Error(`totalTransactions must be between 1 and 100000`);
  }

  const reWs = new RegExp(
    "/^(ws?://)([0-9]{1,3}(?:.[0-9]{1,3}){3}|[a-zA-Z]+):([0-9]{1,5})$/",
  );
  const reWss = new RegExp(
    "/^(wss?://)([0-9]{1,3}(?:.[0-9]{1,3}){3}|[a-zA-Z]+):([0-9]{1,5})$/",
  );

  params.nodes.forEach((node) => {
    if (!(reWs.test(node) || reWss.test(node))) {
      //      throw new Error(
      //        `Invalid node url. You must use a valid websocket endpoint.`
      //      );
    }
  });
}

main()
  .catch((e) => {
    /*eslint no-console: 0*/
    console.error(e);
    process.exit(-1);
  })
  .then((result) => {
    if (result) {
      process.exit(0);
    } else {
      process.exit(-1);
    }
  });
