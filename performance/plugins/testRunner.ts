import BN from "bn.js";
import { Mangata } from "mangata-sdk";
import { testLog } from "../../utils/Logger";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { SubmittableResult } from "@polkadot/api";

export async function preGenerateTransactions(
  testParams: TestParams,
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >
): Promise<SubmittableExtrinsic<"promise", SubmittableResult>[][][]> {
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
  >[][][] = [];
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
        const mgaValue = mgaNodeandUsers.get(nodeThread)!;
        mgaNodeandUsers.set(nodeThread, mgaValue);
        const destUser =
          mgaNodeandUsers.get(nodeThread)?.users![
            (userNo + 1) % mgaNodeandUsers.get(nodeThread)!.users!.length
          ]!;
        const srcUser = mgaNodeandUsers.get(nodeThread)?.users![userNo];
        const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();
        const tx = api!.tx.tokens.transfer(
          destUser.keyPair.address,
          MGA_ASSET_ID,
          new BN(1)
        );
        const signed = tx.sign(srcUser!.keyPair, {
          nonce: mgaValue.users[userNo]!.nonce,
        });
        const userNonceIncremented = mgaValue.users[userNo]!.nonce.add(
          new BN(1)
        );
        mgaValue.users[userNo]!.nonce! = userNonceIncremented;
        //        const signedTx = mgaNodeandUsers
        //          .get(nodeThread)
        //          ?.mgaSdk.transferToken(
        //            srcUser!.keyPair,
        //            MGA_ASSET_ID.toString(),
        //            destUser.keyPair.address,
        //            new BN(1),
        //            { nonce: userNonceIncremented }
        //          );
        batch.push(signed);

        sanityCounter++;
      }
      batches.push(batch);
    }
    thread_payloads.push(batches);
  }
  testLog.getLog().info(`Done pregenerating transactions (${sanityCounter}).`);
  return thread_payloads;
}
