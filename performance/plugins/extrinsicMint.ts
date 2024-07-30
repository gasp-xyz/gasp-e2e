// /* eslint-disable no-console */
// import { BN } from "@polkadot/util";
// import { Mangata } from "gasp-sdk";
// import { TestParams } from "../testParams";
// import { KeyringPair } from "@polkadot/keyring/types";
// import { preGenerateTransactions, runTransactions } from "./testRunner";
// import { ExtrinsicSwap } from "./extrinsicSwap";
// let tokens: number[] = [];
// export class ExtrinsicMint extends ExtrinsicSwap {
//   async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
//     await super.arrange(numberOfThreads, nodes);
//     tokens = this.tokens;
//     return true;
//   }
//   async act(testParams: TestParams): Promise<boolean> {
//     let keepCalling = true;
//     setTimeout(function () {
//       keepCalling = false;
//       //duration in minutes, transform to millisecs.
//     }, testParams.duration * 60 * 1000);
//     while (keepCalling) {
//       const preSetupThreads = await preGenerateTransactions(
//         testParams,
//         this.mgaNodeandUsers,
//         createAndSignMints,
//         { testParams }
//       );
//       console.info(`running Txs..`);
//       await runTransactions(testParams, preSetupThreads);
//     }
//     console.info(`Done running Txs!`);
//     return true;
//   }
// }
// async function createAndSignMints(
//   mgaNodeandUsers: Map<
//     number,
//     { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
//   >,
//   nodeThread: number,
//   userNo: number
//   //  options: { testParams: TestParams }
// ) {
//   const mgaValue = mgaNodeandUsers.get(nodeThread)!;
//   const srcUser = mgaNodeandUsers.get(nodeThread)?.users![userNo];
//   const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();
//   const tx = api!.tx.xyk.mintLiquidity(
//     tokens[0],
//     tokens[1],
//     new BN(2),
//     new BN(3)
//   );
//   const signed = tx.sign(
//     srcUser!.keyPair,
//     //@ts-ignore
//     {
//       nonce: mgaValue.users[userNo]!.nonce,
//     }
//   );
//   return { mgaValue, signed };
// }
