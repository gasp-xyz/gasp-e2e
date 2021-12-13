import {Keyring} from "@polkadot/api";
import BN from "bn.js";
import {Mangata} from "mangata-sdk";
import {testLog} from "../../utils/Logger";
import {TestParams} from "../testParams";
import {TestItem} from "./testItem";
import {KeyringPair} from "@polkadot/keyring/types";
import {UserFactory, Users} from "../../utils/Framework/User/UserFactory";
import {Node} from "../../utils/Framework/Node/Node";
import {MGA_ASSET_ID} from "../../utils/Constants";
import {mintAsset} from "../../utils/tx";
import {initApi} from "../../utils/api";

function seedFromNum(seed: number): string {
  return "//user//" + ("0000" + seed).slice(-4);
}

export class performanceTestItem implements TestItem {
  mgaNodeandUsers = new Map<
    number,
    {mgaSdk: Mangata; users: {nonce: BN; keyPair: KeyringPair}[]}
  >();

  async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
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

  async mintMGATokensToUsers(numberOfThreads: number, nodes: string[]) {
    const keyring = new Keyring({type: "sr25519"});
    const mintPromises = [];
    for (let nodeNumber = 0; nodeNumber < nodes.length; nodeNumber++) {
      const node = nodes[nodeNumber];
      const mga = await getMangata(node);
      const mgaNode = new Node(node);
      const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);

      const users: {nonce: BN; keyPair: KeyringPair}[] = [];
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
        users.push({nonce: nonce, keyPair: keyPair});
      }
      this.mgaNodeandUsers.set(nodeNumber, {mgaSdk: mga, users: users});
    }
    const results = await Promise.all(mintPromises);
    testLog.getLog().info("¡¡ Tokens minted !!" + JSON.stringify(results));

    return true;
  }
  async mintERC20TokensToUsers(
    tokenIds: number[],
    mgaNodeandUsers: Map<
      number,
      {mgaSdk: Mangata; users: {nonce: BN; keyPair: KeyringPair}[]}
    >
  ) {
    const keyring = new Keyring({type: "sr25519"});
    const mintPromises = [];

    for (let nodeNumber = 0; nodeNumber < mgaNodeandUsers.size; nodeNumber++) {
      const mga = mgaNodeandUsers.get(nodeNumber)?.mgaSdk!;
      const users = mgaNodeandUsers.get(nodeNumber)?.users!;
      const mgaNode = new Node(mga.getUri());
      const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);

      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      let sudoNonce = await mga.getNonce(sudo.keyRingPair.address);
      //lets create as many of users as threads.
      for (let i = 0; i < users.length; i++) {
        for (let tokenId = 0; tokenId < tokenIds.length; tokenId++) {
          const token = tokenIds[tokenId];
          mintPromises.push(
            mintAsset(
              sudo.keyRingPair,
              new BN(token),
              users[i].keyPair.address,
              new BN(10).pow(new BN(18)),
              sudoNonce
            )
          );
          sudoNonce = sudoNonce.addn(1);
        }
      }
    }
    const results = await Promise.all(mintPromises);
    testLog.getLog().info("¡¡ Tokens minted !!" + JSON.stringify(results));

    return true;
  }
  async buildMgaNodeandUsers(numberOfThreads: number, nodes: string[]) {
    const keyring = new Keyring({type: "sr25519"});
    for (let nodeNumber = 0; nodeNumber < nodes.length; nodeNumber++) {
      const node = nodes[nodeNumber];
      const mga = await getMangata(node);
      const users: {nonce: BN; keyPair: KeyringPair}[] = [];
      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      //lets create as many of users as threads.
      for (let i = 0; i < numberOfThreads; i++) {
        const stringSeed = seedFromNum(i);
        const keyPair = keyring.addFromUri(stringSeed);
        const nonce = await mga.getNonce(keyPair.address);
        users.push({nonce: nonce, keyPair: keyPair});
      }
      this.mgaNodeandUsers.set(nodeNumber, {mgaSdk: mga, users: users});
    }
  }
}

export async function getMangata(node: string) {
  const mga = Mangata.getInstance(node);
  await initApi(node);
  return mga;
}
