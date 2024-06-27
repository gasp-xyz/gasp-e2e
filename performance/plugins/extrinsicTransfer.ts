/* eslint-disable no-console */
import { BN } from "@polkadot/util";
import { MangataInstance } from "@mangata-finance/sdk";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { runTransactions } from "./testRunner";
import { performanceTestItem } from "./performanceTestItem";
import { testLog } from "../../utils/Logger";

export class ExtrinsicTransfer extends performanceTestItem {
  async arrange(testParams: TestParams): Promise<boolean> {
    await super.arrange(testParams);
    await this.mintTokensToUsers(testParams.threads, testParams.nodes, [
      GASP_ASSET_ID,
    ]);
    return true;
  }

  async act(testParams: TestParams): Promise<boolean> {
    await super.act(testParams);
    await runTransactions(
      this.mgaNodeandUsers,
      testParams,
      createAndSignTransfer,
    );
    console.info(`.... Done Sending Txs`);
    return true;
  }
}

async function createAndSignTransfer(
  mgaSdk: MangataInstance,
  users: { nonce: BN; keyPair: KeyringPair }[],
  threadId: number,
  nonceOffset: BN = new BN(0),
) {
  const destUser = users[(threadId + 1) % users.length];
  const srcUser = users[threadId % users.length];
  const api = await mgaSdk.api();
  const nonce = srcUser.nonce.add(nonceOffset);
  const tx = api!.tx.tokens.transfer(
    destUser.keyPair.address,
    GASP_ASSET_ID,
    new BN(1),
  );
  testLog.getLog().info("::user runing tx::" + srcUser.keyPair.address);
  await tx.signAsync(
    srcUser!.keyPair,
    //@ts-ignore
    {
      nonce,
    },
  );
  return tx;
}
