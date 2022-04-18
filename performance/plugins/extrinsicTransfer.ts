import { BN } from "@polkadot/util";
import { Mangata } from "mangata-sdk";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { preGenerateTransactions, runTransactions } from "./testRunner";
import { performanceTestItem } from "./performanceTestItem";

export class ExtrinsicTransfer extends performanceTestItem {
  async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
    await this.mintMGATokensToUsers(numberOfThreads, nodes);
    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    const preSetupThreads = await preGenerateTransactions(
      testParams,
      this.mgaNodeandUsers,
      createAndSignTransfer
    );
    await runTransactions(testParams, preSetupThreads);
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
  const signed = tx.sign(srcUser!.keyPair, {
    nonce: mgaValue.users[userNo]!.nonce,
  });
  return { mgaValue, signed };
}
