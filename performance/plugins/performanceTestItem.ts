/* eslint-disable no-console */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { Mangata, MangataGenericEvent } from "mangata-sdk";
import { testLog } from "../../utils/Logger";
import { logFile, TestParams } from "../testParams";
import { TestItem } from "./testItem";
import { KeyringPair } from "@polkadot/keyring/types";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { Node } from "../../utils/Framework/Node/Node";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { createPoolIfMissing, mintAsset, transferAsset } from "../../utils/tx";
import { initApi } from "../../utils/api";
import { captureEvents, pendingExtrinsics } from "./testReporter";
import { Guid } from "guid-typescript";
import { User } from "../../utils/User";

function seedFromNum(seed: number): string {
  const guid = Guid.create().toString();
  return "//user//" + ("0000" + seed + guid).slice(-4);
}

export class performanceTestItem implements TestItem {
  mgaNodeandUsers = new Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >();
  listeners: Promise<{ p: Promise<unknown>; cancel: () => boolean }>[] = [];
  async arrange(numberOfThreads: number, nodes: string[]): Promise<boolean> {
    testLog.getLog().info("Arrange" + numberOfThreads + nodes);
    const mga = await getMangata(nodes[0]!);
    const api = await mga.getApi();
    this.listeners.push(captureEvents(logFile, api!));
    this.listeners.push(pendingExtrinsics(logFile, api!));

    return true;
  }
  async act(testParams: TestParams): Promise<boolean> {
    testLog.getLog().info("Act" + testParams);
    return true;
  }
  async expect(nodes: string[]): Promise<boolean> {
    //wait for not Txs pending + 10 blocks.
    const mga = await getMangata(nodes[0]!);
    let pendingExtr: any[] = [];
    do {
      const api = await mga.getApi();
      pendingExtr = await api.rpc.author.pendingExtrinsics();
    } while (pendingExtr.length > 0);
    console.info(`Done waiting Txs!`);
    console.info(`Stopping listeners....`);
    this.listeners.forEach(async (p) => (await p).cancel());
    console.info(`...Stopped`);
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
              (await this.expect(testparams.nodes).then(
                async (resultExpect) => {
                  testLog.getLog().info("Done Expect" + resultExpect);
                  return (
                    resultAct &&
                    (await this.teardown(testparams.nodes).then(
                      async (resultTearDown) => {
                        testLog.getLog().info("Done TearDown");
                        return resultTearDown;
                      }
                    ))
                  );
                }
              ))
            );
          }))
        );
      }
    );
  }
  async createPoolIfMissing(tokenId: BN, tokenId2: BN, nodes: string[]) {
    const keyring = new Keyring({ type: "sr25519" });
    const node = nodes[0];
    const mgaNode = new Node(node);
    const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);
    await createPoolIfMissing(sudo, "100000", tokenId, tokenId2);
  }
  async mintTokensToUsers(
    numberOfThreads: number,
    nodes: string[],
    assets = [MGA_ASSET_ID]
  ) {
    const keyring = new Keyring({ type: "sr25519" });
    const mintPromises: Promise<MangataGenericEvent[]>[] = [];
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
        // eslint-disable-next-line no-loop-func
        assets.forEach((assetId) => {
          mintPromises.push(
            mintAsset(
              sudo.keyRingPair,
              assetId,
              keyPair.address,
              new BN(10).pow(new BN(30)),
              sudoNonce
            )
          );
          sudoNonce = sudoNonce.addn(1);
        });
        users.push({ nonce: nonce, keyPair: keyPair });
      }
      this.mgaNodeandUsers.set(nodeNumber, { mgaSdk: mga, users: users });
    }
    testLog.getLog().info("Waiting for mining tokens");
    const results = await Promise.all(mintPromises);
    testLog.getLog().info("¡¡ Tokens minted !!" + JSON.stringify(results));

    return true;
  }
  async mintERC20TokensToUsers(
    tokenIds: number[],
    mgaNodeandUsers: Map<
      number,
      { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
    >
  ) {
    const keyring = new Keyring({ type: "sr25519" });
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
    const keyring = new Keyring({ type: "sr25519" });
    for (let nodeNumber = 0; nodeNumber < nodes.length; nodeNumber++) {
      const node = nodes[nodeNumber];
      const mga = await getMangata(node);
      const users: { nonce: BN; keyPair: KeyringPair }[] = [];
      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      //lets create as many of users as threads.
      for (let i = 0; i < numberOfThreads; i++) {
        const stringSeed = seedFromNum(i);
        const keyPair = keyring.addFromUri(stringSeed);
        const nonce = await mga.getNonce(keyPair.address);
        users.push({ nonce: nonce, keyPair: keyPair });
      }
      this.mgaNodeandUsers.set(nodeNumber, { mgaSdk: mga, users: users });
    }
  }
  async transferLiqTokensToUsers(
    user: User,
    amount: BN,
    liqAssetId: number,
    mgaNodeandUsers: Map<
      number,
      { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
    >
  ) {
    const transferPromises = [];

    for (let nodeNumber = 0; nodeNumber < mgaNodeandUsers.size; nodeNumber++) {
      const mga = mgaNodeandUsers.get(nodeNumber)?.mgaSdk!;
      const users = mgaNodeandUsers.get(nodeNumber)?.users!;

      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      let userNonce = await mga.getNonce(user.keyRingPair.address);
      //lets create as many of users as threads.
      for (let i = 0; i < users.length; i++) {
        transferPromises.push(
          transferAsset(
            user.keyRingPair,
            new BN(liqAssetId),
            users[i].keyPair.address,
            amount
          )
        );
        userNonce = userNonce.addn(1);
      }
    }
    const results = await Promise.all(transferPromises);
    console.info(`transferred to each user ${amount} of AssetId-${liqAssetId}`);
    testLog.getLog().info("¡¡ Tokens transfered !!" + JSON.stringify(results));

    return true;
  }
}

export async function getMangata(node: string) {
  const mga = Mangata.getInstance([node]);
  await initApi(node);
  return mga;
}
