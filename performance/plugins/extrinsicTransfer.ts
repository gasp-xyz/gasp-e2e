/* eslint-disable no-console */
import { BN } from "@polkadot/util";
import { Mangata } from "@mangata-finance/sdk";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { preGenerateTransactions, runTransactions } from "./testRunner";
import { performanceTestItem } from "./performanceTestItem";
import { Commands } from "../testFactory";

export class ExtrinsicTransfer extends performanceTestItem {
  async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
    await super.arrange(numberOfThreads, nodes);
    await this.mintTokensToUsers(numberOfThreads, nodes, [MGA_ASSET_ID]);
    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    let keepCalling = true;
    setTimeout(function () {
      keepCalling = false;
      //duration in minutes, transform to millisecs.
    }, testParams.duration * 60 * 1000);
    while (keepCalling) {
      let preSetupThreads;
      if (testParams.command === Commands.ExtrinsicTransfer) {
        preSetupThreads = await preGenerateTransactions(
          testParams,
          this.mgaNodeandUsers,
          createAndSignTransfer
        );
      } else {
        preSetupThreads = await preGenerateTransactions(
          testParams,
          this.mgaNodeandUsers,
          createAndSignTransferKA
        );
      }
      await runTransactions(testParams, preSetupThreads);
    }
    console.info(`.... Done Sending Txs`);
    return true;
  }
}

async function createAndSignTransfer(
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  nodeThread: number,
  userNo: number
) {
  const mgaValue = mgaNodeandUsers.get(nodeThread)!;
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
  const signed = tx.signAsync(
    srcUser!.keyPair,
    //@ts-ignore
    {
      nonce: mgaValue.users[userNo]!.nonce,
    }
  );
  return { mgaValue, signed };
}
async function createAndSignTransferKA(
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  nodeThread: number,
  userNo: number
) {
  const mgaValue = mgaNodeandUsers.get(nodeThread)!;
  const destUser =
    mgaNodeandUsers.get(nodeThread)?.users![
      (userNo + 1) % mgaNodeandUsers.get(nodeThread)!.users!.length
    ]!;
  const srcUser = mgaNodeandUsers.get(nodeThread)?.users![userNo];
  const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();
  const tx = api!.tx.tokens.transferKeepAlive(
    destUser.keyPair.address,
    MGA_ASSET_ID,
    new BN(1)
  );
  const signed = tx.sign(
    srcUser!.keyPair,
    //@ts-ignore
    {
      nonce: mgaValue.users[userNo]!.nonce,
    }
  );
  return { mgaValue, signed };
}
