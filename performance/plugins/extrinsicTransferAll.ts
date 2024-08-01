// /* eslint-disable no-console */
// import { BN } from "@polkadot/util";
// import { Mangata } from "gasp-sdk";
// import { TestParams } from "../testParams";
// import { KeyringPair } from "@polkadot/keyring/types";
// import { GASP_ASSET_ID } from "../../utils/Constants";
// import { preGenerateTransactions, runTransactions } from "./testRunner";
// import { performanceTestItem } from "./performanceTestItem";
//
// export class ExtrinsicTransferAll extends performanceTestItem {
//   assets = [1, 3];
//   async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
//     await super.arrange(numberOfThreads, nodes);
//     await this.mintTokensToUsers(numberOfThreads, nodes, [GASP_ASSET_ID]);
//     await this.mintERC20TokensToUsers(this.assets, this.mgaNodeandUsers);
//     return true;
//   }
//   async act(testParams: TestParams): Promise<boolean> {
//     let keepCalling = true;
//     setTimeout(function () {
//       keepCalling = false;
//       //duration in minutes, transform to millisecs.
//     }, testParams.duration * 60 * 1000);
//     let index = 0;
//     while (keepCalling) {
//       const preSetupThreads = await preGenerateTransactions(
//         testParams,
//         this.mgaNodeandUsers,
//         createAndSignTransferAll,
//         { assetId: this.assets[index % this.assets.length] }
//       );
//
//       await runTransactions(testParams, preSetupThreads);
//       index++;
//     }
//     console.info(`.... Done Sending Txs`);
//     return true;
//   }
// }
//
// async function createAndSignTransferAll(
//   mgaNodeandUsers: Map<
//     number,
//     { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
//   >,
//   nodeThread: number,
//   userNo: number,
//   options: { assetId: BN }
// ) {
//   const mgaValue = mgaNodeandUsers.get(nodeThread)!;
//   const destUser =
//     mgaNodeandUsers.get(nodeThread)?.users![
//       (userNo + 1) % mgaNodeandUsers.get(nodeThread)!.users!.length
//     ]!;
//   const srcUser = mgaNodeandUsers.get(nodeThread)?.users![userNo];
//   const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();
//   let tx: any;
//   if (new BN(userNo).add(mgaValue.users[userNo]!.nonce).toNumber() % 2 === 0) {
//     //user number + nonce %2 == 0 --> remark!
//     tx = api!.tx.system.remark("0x00");
//   } else {
//     tx = api!.tx.tokens.transferAll(
//       destUser.keyPair.address,
//       options.assetId!,
//       true
//     );
//   }
//   const signed = tx.sign(srcUser!.keyPair, {
//     nonce: mgaValue.users[userNo]!.nonce,
//   });
//   return { mgaValue, signed };
// }
