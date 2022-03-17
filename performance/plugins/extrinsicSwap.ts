/* eslint-disable no-console */
import BN from "bn.js";
import { Mangata } from "mangata-sdk";
import { TestParams } from "../testParams";
import { KeyringPair } from "@polkadot/keyring/types";
import { preGenerateTransactions, runTransactions } from "./testRunner";
import { performanceTestItem } from "./performanceTestItem";
import { Assets } from "../../utils/Assets";
import { Node } from "../../utils/Framework/Node/Node";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { Keyring } from "@polkadot/api";
import { Commands } from "../testFactory";
import { MAX_BALANCE } from "../../utils/Constants";
let tokens: number[] = [];
export class ExtrinsicSwap extends performanceTestItem {
  async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
    await super.arrange(numberOfThreads, nodes);
    //create tokens for testing.
    const mgaNode = new Node(nodes[0]);
    const keyring = new Keyring({ type: "sr25519" });
    const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);
    tokens = await Assets.setupUserWithCurrencies(
      sudo,
      [new BN(100000), new BN(100000)],
      sudo
    ).then((values) => {
      return values.map((val) => val.toNumber());
    });
    //create the pool
    await this.createPoolIfMissing(new BN(tokens[0]), new BN(tokens[1]), nodes);
    await this.mintTokensToUsers(numberOfThreads, nodes);
    await this.mintERC20TokensToUsers(tokens, this.mgaNodeandUsers);
    console.info(`Setup Done!`);
    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    let keepCalling = true;
    setTimeout(function () {
      keepCalling = false;
      //duration in minutes, transform to millisecs.
    }, testParams.duration * 60 * 1000);
    while (keepCalling) {
      const preSetupThreads = await preGenerateTransactions(
        testParams,
        this.mgaNodeandUsers,
        createAndSignSwaps,
        { testParams }
      );
      console.info(`running Txs..`);
      await runTransactions(testParams, preSetupThreads);
    }
    console.info(`Done running Txs!`);
    return true;
  }
}
async function createAndSignSwaps(
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  nodeThread: number,
  userNo: number,
  options: { testParams: TestParams }
) {
  const mgaValue = mgaNodeandUsers.get(nodeThread)!;
  const srcUser = mgaNodeandUsers.get(nodeThread)?.users![userNo];
  const api = await mgaNodeandUsers.get(nodeThread)?.mgaSdk.getApi();
  let assets = [tokens[0], tokens[1]];
  if (srcUser!.nonce.toNumber() % 2 === 0) {
    assets = [tokens[1], tokens[0]];
  }
  let tx;
  if (options.testParams.command === Commands.SwapBuy) {
    tx = api!.tx.xyk.buyAsset(assets[0], assets[1], new BN(1), MAX_BALANCE);
  } else {
    tx = api!.tx.xyk.sellAsset(assets[0], assets[1], new BN(1), new BN(0));
  }
  const signed = tx.sign(srcUser!.keyPair, {
    nonce: mgaValue.users[userNo]!.nonce,
  });
  return { mgaValue, signed };
}
