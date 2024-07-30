// import { BN } from "@polkadot/util";
// import { Mangata } from "gasp-sdk";
// import { TestParams } from "../testParams";
// import { KeyringPair } from "@polkadot/keyring/types";
// import { preGenerateTransactions, runQuery } from "./testRunner";
// import { performanceTestItem } from "./performanceTestItem";
// //not proud about this, but lets leave it like this until we send some optional params.
// export class Ping extends performanceTestItem {
//   async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
//     await this.buildMgaNodeandUsers(numberOfThreads, nodes);
//     return true;
//   }
//   async act(testParams: TestParams): Promise<boolean> {
//     const now = new Date().getTime();
//     const duration = testParams.duration;
//     while (now / 1000 + duration > new Date().getTime() / 1000) {
//       await await this.buildMgaNodeandUsers(
//         testParams.threads,
//         testParams.nodes
//       );
//       const preSetupThreads = await preGenerateTransactions(
//         testParams,
//         this.mgaNodeandUsers,
//         createPings
//       );
//       await runQuery(testParams, preSetupThreads);
//     }
//     return true;
//   }
// }
//
// async function createPings(
//   mgaNodeandUsers: Map<
//     number,
//     { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
//   >,
//   nodeThread: number
//   //  userNo: number
// ) {
//   const mgaValue = mgaNodeandUsers.get(nodeThread)!;
//   const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();
//   const tx = api!.query.timestamp.now();
//   return { mgaValue, tx };
// }
