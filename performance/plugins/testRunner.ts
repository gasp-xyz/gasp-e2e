/* eslint-disable no-console */
/* eslint-disable no-loop-func */
import { BN } from "@polkadot/util";
import { Mangata } from "@mangata-finance/sdk";
import { testLog } from "../../utils/Logger";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { SubmittableResult } from "@polkadot/api";

import { blake2AsHex } from '@polkadot/util-crypto';
import asyncPool from "tiny-async-pool";
import { TestsCases } from "../testFactory";

export async function runTransactions(
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  testParams: TestParams,
  generator: any
) {
  if (testParams.testCase === TestsCases.ConcurrentTest) {
    await runTxsInConcurrentMode(
      mgaNodeandUsers,
      testParams,
      generator
    )
  } else if (testParams.testCase === TestsCases.Burst) {
    await runTxsInBurstMode(
      mgaNodeandUsers,
      testParams,
      generator
    )
  }
  testLog.getLog().info(`Sent!`);
  testLog.getLog().info("All promises fulfilled");
  return;
}

async function executionThread(threadId: number, testParams: TestParams, sdk: Mangata, generator: any) {
  const limit = Math.ceil(testParams.totalTx / testParams.threads);
  const load = Math.min(limit, Math.ceil(testParams.pending / testParams.threads));
  console.info(`Worker [${threadId}] starting execution thread load: ${load} limit: ${limit}`)

  let myTxs = new Set();
  let api = await sdk.getApi()!;
  let exec_counter = 0;
  let nonce_offset = 0;
  let promises = [];
  let now = (await api.rpc.chain.getHeader()).number.toNumber();

  return new Promise<void>(async (resolve, _reject) => {
    const unsub = await api.rpc.chain.subscribeNewHeads(async (header: any) => {

      let queue = await (await api.at(header.hash)).query.system.storageQueue();

      for (let i = 0; i < queue.length; i++) {
        for (let j = 0; j < queue[i][2].length; ++j) {
          const tx = queue[i][2][j][1];
          const tx_hash = blake2AsHex(tx);
          if (myTxs.has(tx_hash)) {
            exec_counter++;
            myTxs.delete(tx_hash)
          }
        }
      }

      if (exec_counter >= limit || (header.number.toNumber() - now) >= testParams.duration) {
        unsub();
        resolve();
        return
      }

      let txs = await Promise.all([...Array(load - myTxs.size).keys()].map(id => {
        return generator(new BN(id + nonce_offset));
      }));
      nonce_offset += txs.length;

      txs.forEach(tx => myTxs.add(tx.hash.toString()));
      txs.forEach(tx => promises.push(tx.send()))
      console.info(`Worker [${threadId}] #${header.number} submitted ${txs.length} txs`)
    });
  });

}


async function runTxsInConcurrentMode(
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  testParams: TestParams,
  generator: any
) {

  let txGenerators = [...Array(testParams.threads).keys()].map(threadId => {
    let { mgaSdk, users } = mgaNodeandUsers.get(threadId % mgaNodeandUsers.size)!;
    return { mgaSdk: mgaSdk, threadId, generator: (offset: BN) => { return generator(mgaSdk, users, threadId, offset); } };
  });

  let executors = txGenerators.map(({ mgaSdk, threadId, generator }) => executionThread(threadId, testParams, mgaSdk, generator))
  await Promise.all(executors);
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

async function runTxsInBurstMode(
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  testParams: TestParams,
  generator: any
) {
  testParams.pending = Number.MAX_VALUE;
  return runTxsInConcurrentMode(mgaNodeandUsers, testParams, generator)
}
