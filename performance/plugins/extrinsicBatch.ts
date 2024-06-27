// /* eslint-disable no-console */
// import { BN } from "@polkadot/util";
// import { Mangata } from "@mangata-finance/sdk";
// import { TestParams } from "../testParams";
// import { KeyringPair } from "@polkadot/keyring/types";
// import { GASP_ASSET_ID } from "../../utils/Constants";
// import { preGenerateTransactions, runTransactions } from "./testRunner";
// import { ExtrinsicTransfer } from "./extrinsicTransfer";
//
// export class ExtrinsicBatch extends ExtrinsicTransfer {
//   async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
//     await super.arrange(numberOfThreads, nodes);
//     await this.mintTokensToUsers(numberOfThreads, nodes, [GASP_ASSET_ID]);
//     return true;
//   }
//   async act(testParams: TestParams): Promise<boolean> {
//     let keepCalling = true;
//     setTimeout(function() {
//       keepCalling = false;
//       //duration in minutes, transform to millisecs.
//     }, testParams.duration * 60 * 1000);
//     let numberOfBatchedTxs = 0;
//     while (keepCalling) {
//       const preSetupThreads = await preGenerateTransactions(
//         testParams,
//         this.mgaNodeandUsers,
//         createAndSignBatchTransfer,
//         { inBatchesOf: numberOfBatchedTxs }
//       );
//       await runTransactions(testParams, preSetupThreads);
//       numberOfBatchedTxs += 10;
//     }
//     console.info(`.... Done Sending Txs`);
//     return true;
//   }
// }
//
// async function createAndSignBatchTransfer(
//   mgaNodeandUsers: Map<
//     number,
//     { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
//   >,
//   nodeThread: number,
//   userNo: number,
//   options: { inBatchesOf: number }
// ) {
//   const mgaValue = mgaNodeandUsers.get(nodeThread)!;
//   const destUser =
//     mgaNodeandUsers.get(nodeThread)?.users![
//     (userNo + 1) % mgaNodeandUsers.get(nodeThread)!.users!.length
//     ]!;
//   const srcUser = mgaNodeandUsers.get(nodeThread)?.users![userNo];
//   const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();
//   const txs: any = [];
//   Array.from(Array(options.inBatchesOf).keys()).forEach(() => {
//     txs.push(
//       api!.tx.tokens.transfer(destUser.keyPair.address, GASP_ASSET_ID, new BN(1))
//     );
//   });
//   const signed = api!.tx.utility.batch(txs).sign(
//     srcUser!.keyPair,
//     //@ts-ignore
//     {
//       nonce: mgaValue.users[userNo]!.nonce,
//     }
//   );
//   return { mgaValue, signed };
// }
