import { BN } from "@polkadot/util";
import { Mangata } from "mangata-sdk";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { preGenerateTransactions, runTransactions } from "./testRunner";
import { performanceTestItem } from "./performanceTestItem";
//not proud about this, but lets leave it like this until we send some optional params.
let tokens: number[] = [];
export class ExtrinsicSwap extends performanceTestItem {
  async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
    tokens = [4, 5];
    await this.mintMGATokensToUsers(numberOfThreads, nodes);
    await this.mintERC20TokensToUsers(tokens, this.mgaNodeandUsers);
    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    const preSetupThreads = await preGenerateTransactions(
      testParams,
      this.mgaNodeandUsers,
      createAndSignSwaps
    );
    await runTransactions(testParams, preSetupThreads);
    return true;
  }
}

async function createAndSignSwaps(
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  nodeThread: number,
  userNo: number
) {
  const mgaValue = mgaNodeandUsers.get(nodeThread)!;
  const srcUser = mgaNodeandUsers.get(nodeThread)?.users![userNo];
  const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();

  const tx = api!.tx.xyk.sellAsset(
    tokens[0],
    tokens[1],
    new BN(100),
    new BN(0)
  );
  const signed = tx.sign(srcUser!.keyPair, {
    nonce: mgaValue.users[userNo]!.nonce,
  });
  return { mgaValue, signed };
}
