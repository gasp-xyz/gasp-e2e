/* eslint-disable no-console */
/* eslint-disable no-loop-func */
import { BN } from "@polkadot/util";
import { Mangata } from "@mangata-finance/sdk";
import { testLog } from "../../utils/Logger";
import { TestParams } from "../testParams";
import { logLine } from "./testReporter";
import { KeyringPair } from "@polkadot/keyring/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { SubmittableResult } from "@polkadot/api";

import asyncPool from "tiny-async-pool";
import { TestsCases } from "../testFactory";
import { getMangata } from "./performanceTestItem";
import { waitNewBlock } from "../../utils/eventListeners";
import { sleep } from "../../utils/utils";

export async function preGenerateTransactions(
  testParams: TestParams,
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  fn: any,
  options?: {}
): Promise<SubmittableExtrinsic<"promise", SubmittableResult>[][]> {
  testLog
    .getLog()
    .info(
      `Pregenerating ${testParams.totalTx} transactions across ${testParams.threads} threads...`
    );
  const totalBatches = testParams.totalTx / testParams.threads;
  //const userPerThread = 1;

  const thread_payloads: SubmittableExtrinsic<
    "promise",
    SubmittableResult
  >[][] = [];
  let sanityCounter = 0;
  for (let nodeThread = 0; nodeThread < testParams.nodes.length; nodeThread++) {
    const batches = [];
    for (let batchNo = 0; batchNo < totalBatches; batchNo++) {
      const batch = [];
      for (
        let userNo = 0;
        userNo < mgaNodeandUsers.get(nodeThread)!.users.length;
        userNo++
      ) {
        const { mgaValue, signed } = await fn(
          mgaNodeandUsers,
          nodeThread,
          userNo,
          options
        );
        mgaValue.users[userNo]!.nonce! = mgaValue.users[userNo]!.nonce.add(
          new BN(1)
        );
        batch.push(signed);

        sanityCounter++;
      }
      batches.push(batch);
    }
    const flatten = batches.reduce(
      (accumulator, value) => accumulator.concat(value),
      []
    );
    thread_payloads.push(flatten);
  }
  testLog.getLog().info(`Done pregenerating transactions (${sanityCounter}).`);
  return thread_payloads;
}

export async function runTransactions(
  testParams: TestParams,
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][]
) {
  const nodePromises: any[] = [];

  for (let nodeIdx = 0; nodeIdx < testParams.nodes.length; nodeIdx++) {
    const nodeThreads = testParams.threads;
    if (testParams.testCase === TestsCases.ConcurrentTest) {
      nodePromises.push(
        runTxsInConcurrentMode(
          preSetupThreads,
          nodeIdx,
          testParams,
          nodeThreads
        )
      );
    } else if (testParams.testCase === TestsCases.Burst) {
      nodePromises.push(
        runTxsInBurstMode(preSetupThreads, nodeIdx, testParams)
      );
    }
  }
  const results = await Promise.all(nodePromises);
  // eslint-disable-next-line no-console
  testLog.getLog().info(`Sent!`);
  testLog.getLog().info("All promises fulfilled");
  return results;
}

async function runTxsInConcurrentMode(
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][],
  nodeIdx: number,
  testParams: TestParams,
  nodeThreads: number
) {
  const runNodeTxs = (i: number) =>
    new Promise<[number, number]>(async (resolve) => {
      const transaction = await preSetupThreads[nodeIdx][i];
      const start = new Date().getTime();
      try {
        await transaction
          .send(async ({ status }) => {
            if (status.isBroadcast) {
              const finalized = new Date().getTime();
              const diff = finalized - start;
              resolve([i, diff]);
              logLine(
                testParams.logFile,
                "\n" +
                  new Date().toUTCString() +
                  "-" +
                  JSON.stringify(status.toHuman()!)
              );
              await sleep(2000);
              return;
            }
          })
          .catch((err: any) => {
            logLine(
              testParams.logFile,
              "\n" +
                new Date().toUTCString() +
                "- ERROR - " +
                JSON.stringify(err)
            );
            testLog.getLog().warn(err);
            resolve([i, 0]);
            return -1;
          });
      } catch (error) {
        logLine(
          testParams.logFile,
          "\n" + new Date().toUTCString() + "- ERROR - " + JSON.stringify(error)
        );
        testLog.getLog().warn(error);
        resolve([i, 0]);
      }
    });
  const nodeTxs = preSetupThreads[nodeIdx];
  const indexArray = nodeTxs.map((_, index) => {
    return index;
  });
  testLog
    .getLog()
    .info(
      `Sending  in ${nodeThreads} Threads ${preSetupThreads[0].length} Txs...`
    );
  await asyncPool(nodeThreads, indexArray, runNodeTxs);
}
async function runTxsInBurstMode(
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][],
  nodeIdx: number,
  testParams: TestParams
) {
  const sorted = preSetupThreads[nodeIdx].sort(function (a, b) {
    return (
      parseFloat(JSON.parse(a.toString()).signature.nonce) -
      parseFloat(JSON.parse(b.toString()).signature.nonce)
    );
  });

  const runNodeTxs = (i: number) =>
    new Promise<[number, number]>(async (resolve) => {
      const transaction = await sorted[i];
      await transaction
        .send(({ status }) => {
          if (status.isBroadcast || status.isFuture || status.isReady) {
            // eslint-disable-next-line no-console
            console.info(
              "Sending Tx with nonce -> " +
                JSON.parse(sorted[i].toString()).signature.nonce
            );
            resolve([i, 1]);
            return;
          }
        })
        .catch((err: any) => {
          logLine(
            testParams.logFile,
            "\n" +
              new Date().toUTCString() +
              "- ERROR - " +
              JSON.stringify(err.toHuman()!)
          );
          testLog.getLog().warn(err);
          return;
        });
    });

  //is burst, so lets move the first tx to the end.
  //so right after all the Txs with node > the first one are submitted.
  const indexArray = sorted.map((_, index) => {
    return index;
  });
  testLog
    .getLog()
    .info(
      `Sending  in ${sorted.length} Threads ${preSetupThreads[0].length} Txs...`
    );

  const mga = await getMangata(testParams.nodes[nodeIdx]!);
  let pendingTxs = await (await mga.getApi()).rpc.author.pendingExtrinsics();
  while (pendingTxs.length > 5000) {
    await waitNewBlock();
    try {
      pendingTxs = await (
        await await mga.getApi()
      ).rpc.author.pendingExtrinsics();
    } catch (error) {
      console.warn("error - rpc " + error);
    }
  }

  await asyncPool(
    testParams.threads,
    indexArray, //.slice(testParams.threads),
    runNodeTxs
  );
  //  await asyncPool(
  //    testParams.threads,
  //    [...Array(testParams.threads).keys()],
  //    runNodeTxs
  //  );
}

export async function runQuery(
  testParams: TestParams,
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][]
) {
  const nodePromises = [];
  for (let nodeIdx = 0; nodeIdx < testParams.nodes.length; nodeIdx++) {
    const nodeThreads = testParams.threads;
    const runNodeTxs = (i: number) =>
      new Promise<[number, number]>(async (resolve) => {
        const transaction = preSetupThreads[nodeIdx][i];
        const start = new Date().getTime();
        await transaction;
        const finalized = new Date().getTime();
        const diff = finalized - start;
        resolve([i, diff]);
      });
    const nodeTxs = preSetupThreads[nodeIdx];
    const indexArray = nodeTxs.map((_, index) => {
      return index;
    });
    nodePromises.push(asyncPool(nodeThreads, indexArray, runNodeTxs));
  }
  const results = await Promise.all(nodePromises);
  // eslint-disable-next-line no-console
  console.info(
    "Test results \n --------- \n" +
      JSON.stringify(results) +
      "\n  ----------- Test results"
  );
  testLog.getLog().info("All promises fulfilled");
  return results;
}
