// /* eslint-disable no-console */
// import { BN } from "@polkadot/util";
// import { Mangata } from "gasp-sdk";
// import { TestParams } from "../testParams";
// import { KeyringPair } from "@polkadot/keyring/types";
// import { preGenerateTransactions, runTransactions } from "./testRunner";
// import { Assets } from "../../utils/Assets";
// import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
// import { Node } from "../../utils/Framework/Node/Node";
// import { Keyring } from "@polkadot/api";
// import { MAX_BALANCE } from "../../utils/Constants";
// import { performanceTestItem } from "./performanceTestItem";
// let tokens: number[] = [];
// export class ExtrinsicBurn extends performanceTestItem {
//   async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
//     await super.arrange(numberOfThreads, nodes);
//     //create tokens for testing.
//     const mgaNode = new Node(nodes[0]);
//     const keyring = new Keyring({ type: "sr25519" });
//     const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);
//     tokens = await Assets.setupUserWithCurrencies(
//       sudo,
//       [new BN(MAX_BALANCE), new BN(MAX_BALANCE)],
//       sudo
//     ).then((values) => {
//       return values.map((val) => val.toNumber());
//     });
//     //create the pool
//     await sudo.createPoolToAsset(
//       MAX_BALANCE,
//       MAX_BALANCE,
//       new BN(tokens[0]),
//       new BN(tokens[1])
//     );
//     await this.mintTokensToUsers(numberOfThreads, nodes);
//
//     const totalLiqTokens = MAX_BALANCE.div(new BN(2));
//     const tokensPerUser = totalLiqTokens.div(
//       new BN(numberOfThreads).mul(new BN(nodes.length))
//     );
//     await this.transferLiqTokensToUsers(
//       sudo,
//       tokensPerUser,
//       tokens[1] + 1,
//       this.mgaNodeandUsers
//     );
//     console.info(`Setup Done!`);
//     return true;
//   }
//   async act(testParams: TestParams): Promise<boolean> {
//     let keepCalling = true;
//     setTimeout(function() {
//       keepCalling = false;
//       //duration in minutes, transform to millisecs.
//     }, testParams.duration * 60 * 1000);
//     while (keepCalling) {
//       const preSetupThreads = await preGenerateTransactions(
//         testParams,
//         this.mgaNodeandUsers,
//         createAndSignBurn,
//         { testParams }
//       );
//       console.info(`running Txs..`);
//       await runTransactions(testParams, preSetupThreads);
//     }
//     console.info(`Done running Txs!`);
//     return true;
//   }
// }
// async function createAndSignBurn(
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
//   const tx = api!.tx.xyk.burnLiquidity(tokens[0], tokens[1], new BN(2));
//   const signed = tx.sign(
//     srcUser!.keyPair,
//     //@ts-ignore
//     {
//       nonce: mgaValue.users[userNo]!.nonce,
//     }
//   );
//   return { mgaValue, signed };
// }
