import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { Mangata } from "mangata-sdk";
import { testLog } from "../../utils/Logger";
import { TestParams } from "../testParams";
import { TestItem } from "./testItem";
import { KeyringPair } from "@polkadot/keyring/types";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { Node } from "../../utils/Framework/Node/Node";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { mintAsset } from "../../utils/tx";
import { getApi, initApi } from "../../utils/api";
import { preGenerateTransactions, runTransactions } from "./testRunner";

function seedFromNum(seed: number): string {
  return "//user//" + ("0000" + seed).slice(-4);
}

const mgaNodeandUsers = new Map<
  number,
  { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
>();
export class ExtrinsicTransfer implements TestItem {
  async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
    const keyring = new Keyring({ type: "sr25519" });
    const mintPromises = [];
    for (let nodeNumber = 0; nodeNumber < nodes.length; nodeNumber++) {
      const node = nodes[nodeNumber];
      const mga = await getMangata(node);
      const mgaNode = new Node(node);
      const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);

      const users: { nonce: BN; keyPair: KeyringPair }[] = [];
      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      let sudoNonce = await mga.getNonce(sudo.keyRingPair.address);
      //lets create as many of users as threads.
      for (let i = 0; i < numberOfThreads; i++) {
        const stringSeed = seedFromNum(i);
        const keyPair = keyring.addFromUri(stringSeed);
        const nonce = await mga.getNonce(keyPair.address);
        //lets mint some MGA assets to pay fees
        mintPromises.push(
          mintAsset(
            sudo.keyRingPair,
            MGA_ASSET_ID,
            keyPair.address,
            new BN(10).pow(new BN(18)),
            sudoNonce
          )
        );
        sudoNonce = sudoNonce.addn(1);
        users.push({ nonce: nonce, keyPair: keyPair });
      }
      mgaNodeandUsers.set(nodeNumber, { mgaSdk: mga, users: users });
    }
    const results = await Promise.all(mintPromises);
    testLog
      .getLog()
      .info("All nonces and users fetched!" + JSON.stringify(results));

    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    const preSetupThreads = await preGenerateTransactions(
      testParams,
      mgaNodeandUsers
    );
    await runTransactions(testParams, preSetupThreads);
    return true;
  }
  async expect(): Promise<boolean> {
    return true;
  }
  async teardown(nodes: string[]): Promise<boolean> {
    for (let nodeNumber = 0; nodeNumber < nodes.length; nodeNumber++) {
      const node = nodes[nodeNumber];
      const mga = await getMangata(node);
      (await mga.getApi()).disconnect();
    }
    return true;
  }
  async run(testparams: TestParams): Promise<boolean> {
    return this.arrange(testparams.threads, testparams.nodes).then(
      async (result) => {
        testLog.getLog().info("Done Arrange");
        return (
          result &&
          (await this.act(testparams).then(async (resultAct) => {
            testLog.getLog().info("Done Act");
            return (
              resultAct &&
              (await this.expect().then(async (resultExpect) => {
                testLog.getLog().info("Done Expect");
                return (
                  resultAct &&
                  (await this.teardown(testparams.nodes).then(
                    async (resultTearDown) => {
                      testLog.getLog().info("Done TearDown");
                      return resultTearDown;
                    }
                  ))
                );
              }))
            );
          }))
        );
      }
    );
  }
}
async function getMangata(node: string) {
  const mga = Mangata.getInstance(node);
  try {
    getApi();
  } catch (e) {
    await initApi(node);
  }
  return mga;
}
