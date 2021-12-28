import BN from "bn.js";
import {Mangata} from "mangata-sdk";
import {testLog} from "../../utils/Logger";
import {TestParams} from "../testParams";
import {KeyringPair} from "mangata-sdk/node_modules/@polkadot/keyring/types";
import {SubmittableExtrinsic} from "mangata-sdk/node_modules/@polkadot/api/types";
import {SubmittableResult} from "mangata-sdk/node_modules/@polkadot/api";

import asyncPool from "tiny-async-pool";

export async function preGenerateTransactions(
  testParams: TestParams,
  mgaNodeandUsers: Map<
    number,
    {mgaSdk: Mangata; users: {nonce: BN; keyPair: KeyringPair}[]}
  >,
  fn: any
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
        const {mgaValue, signed} = await fn(
          mgaNodeandUsers,
          nodeThread,
          userNo
        );
        const userNonceIncremented = mgaValue.users[userNo]!.nonce.add(
          new BN(1)
        );
        mgaValue.users[userNo]!.nonce! = userNonceIncremented;
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
  const nodePromises = [];
  for (let nodeIdx = 0; nodeIdx < testParams.nodes.length; nodeIdx++) {
    const nodeThreads = testParams.threads;
    const runNodeTxs = (i: number) =>
      new Promise<[number, number]>(async (resolve) => {
        const transaction = await preSetupThreads[nodeIdx][i];
        const start = new Date().getTime();
        await transaction
          .send(({status}) => {
            if (status.isFinalized) {
              const finalized = new Date().getTime();
              const diff = finalized - start;
              resolve([i, diff]);
              return;
            }
          })
          .catch((err: any) => {
            testLog.getLog().warn(err);
            return -1;
          });
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
