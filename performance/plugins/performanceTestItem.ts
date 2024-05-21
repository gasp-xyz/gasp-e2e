/* eslint-disable no-console */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import {
  Mangata,
  MangataGenericEvent,
  MangataInstance,
} from "@mangata-finance/sdk";
import { testLog } from "../../utils/Logger";
import { TestParams } from "../testParams";
import { TestItem } from "./testItem";
import { KeyringPair } from "@polkadot/keyring/types";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { Node } from "../../utils/Framework/Node/Node";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { createPoolIfMissing, mintAsset, transferAsset } from "../../utils/tx";
import { initApi } from "../../utils/api";
import {
  generateHtmlReport,
  writeToFile,
  trackPendingExtrinsics,
  trackExecutedExtrinsics,
  trackEnqueuedExtrinsics,
} from "./testReporter";
import { User } from "../../utils/User";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { quantile } from "simple-statistics";
import ipc from "node-ipc";
import { getSudoUser, setupApi } from "../../utils/setup";
import { EthUser } from "../../utils/EthUser";
import { randomBytes } from "crypto";

/**
function seedFromNum(seed: number): string {
  const guid = Guid.create().toString();
  return "//user//" + ("0000" + seed + guid).slice(-4);
}
  */

function createUserSequentially(): string {
  return "0x" + randomBytes(32).toString("hex");
}

export class performanceTestItem implements TestItem {
  mgaNodeandUsers = new Map<
    number,
    { mgaSdk: MangataInstance; users: { nonce: BN; keyPair: KeyringPair }[] }
  >();

  enqueued: Promise<[number, number][]> = new Promise<[number, number][]>(
    (resolve) => {
      resolve([]);
    },
  );
  executed: Promise<[number, number][]> = new Promise<[number, number][]>(
    (resolve) => {
      resolve([]);
    },
  );
  pending: Promise<[number, number][]> = new Promise<[number, number][]>(
    (resolve) => {
      resolve([]);
    },
  );
  ipc: any;

  async arrange(testParams: TestParams): Promise<boolean> {
    console.info("helo world");
    console.info(testParams.nodes);
    const mga = await getMangata(testParams.nodes[0]!);
    const api = await mga.api();
    const sudo = getSudoUser();
    const sudoKeyringPair = sudo.keyRingPair;
    const nonce = await api.rpc.system.accountNextIndex(
      sudoKeyringPair.address,
    );
    ipc.config.id = "nonceManager";
    ipc.config.retry = 1500;
    ipc.config.silent = false;
    ipc.config.sync = true;
    ipc.serve(function () {
      ipc.server.on("getNonce", (data: any, socket: any) => {
        console.info("serving nonce" + data.id + " " + nonce);
        ipc.server.emit(socket, "nonce-" + data.id, nonce.toNumber());
        nonce.iaddn(1);
      });
    });

    ipc.server.start();
    this.ipc = ipc;
    console.info(testParams.nodes);

    return true;
  }

  async act(testParams: TestParams): Promise<boolean> {
    console.info("helo world 2");
    console.info(testParams.nodes);
    const mga = await getMangata(testParams.nodes[0]!);
    const api = await mga.api();
    this.executed = trackExecutedExtrinsics(api, testParams.duration);
    this.enqueued = trackEnqueuedExtrinsics(api, testParams.duration);
    this.pending = trackPendingExtrinsics(api, testParams.duration);
    return true;
  }

  async expect(testParams: TestParams): Promise<boolean> {
    let [executed, enqueued, pending] = await Promise.all([
      this.executed,
      this.enqueued,
      this.pending,
    ]);

    writeToFile("executed.txt", executed);
    writeToFile("enqueued.txt", enqueued);
    writeToFile("pending.txt", pending);
    generateHtmlReport("report.html", enqueued, executed, pending);

    // ignore first few blocks
    executed = executed.slice(5);
    enqueued = enqueued.slice(5);
    pending = pending.slice(5);

    console.info(executed);
    console.info(enqueued);
    console.info(pending);

    const execution_throughput = quantile(
      executed.map(([_, val]) => val),
      0.1,
    );
    const enqueue_throughput = quantile(
      enqueued.map(([_, val]) => val),
      0.1,
    );
    const pending_throughput = quantile(
      pending.map(([_, val]) => val),
      0.1,
    );

    console.info(
      `execution_thruput : 90% of measurements was above ${execution_throughput}`,
    );
    console.info(
      `enqueue_thruput   : 90% of measurements was above ${enqueue_throughput}`,
    );
    console.info(
      `pending_thruput   : 90% of measurements was above ${pending_throughput}`,
    );

    if (execution_throughput < testParams.throughput) {
      console.info(
        `execution throughput was to low: ${execution_throughput} <= ${testParams.throughput}`,
      );
      return false;
    }

    if (enqueue_throughput < testParams.throughput) {
      console.info(
        `enqueued throughput was to low: ${execution_throughput} <= ${testParams.throughput}`,
      );
      return false;
    }

    if (pending_throughput < testParams.throughput * 0.75) {
      console.info(
        `pending throughput was too small, consider increasing pending/totalTx parameter`,
      );
      return false;
    }

    return true;
  }

  async teardown(): Promise<boolean> {
    const apis = await Promise.all(
      [...this.mgaNodeandUsers.values()].map(({ mgaSdk }) => mgaSdk.api()),
    );
    await Promise.all(apis.map((api) => api.disconnect()));
    await this.ipc.server.stop();
    return true;
  }
  async run(testparams: TestParams): Promise<boolean> {
    return this.arrange(testparams).then(async (result) => {
      testLog.getLog().info("Done Arrange");
      return (
        result &&
        (await this.act(testparams).then(async (resultAct) => {
          testLog.getLog().info("Done Act");
          return (
            resultAct &&
            (await this.expect(testparams).then(async (resultExpect) => {
              testLog.getLog().info("Done Expect" + resultExpect);
              return (
                (await this.teardown().then(async (resultTearDown) => {
                  testLog.getLog().info("Done TearDown");
                  return resultTearDown;
                })) &&
                resultAct &&
                resultExpect
              );
            }))
          );
        }))
      );
    });
  }
  async createPoolIfMissing(tokenId: BN, tokenId2: BN, nodes: string[]) {
    const keyring = new Keyring({ type: "ethereum" });
    const node = nodes[0];
    const mgaNode = new Node(node);
    const sudo = UserFactory.createUser(
      Users.SudoUser,
      keyring,
      mgaNode,
    ) as SudoUser;
    await sudo.node.connect();
    await createPoolIfMissing(
      sudo,
      "1000000000000000000000000000",
      tokenId,
      tokenId2,
    );
  }
  async mintTokensToUsers(
    numberOfThreads: number,
    nodes: string[],
    assets = [MGA_ASSET_ID],
  ) {
    const keyring = new Keyring({ type: "ethereum" });
    const mintPromises: Promise<MangataGenericEvent[]>[] = [];
    await setupApi();
    for (let nodeNumber = 0; nodeNumber < nodes.length; nodeNumber++) {
      const node = nodes[nodeNumber];
      const mga = await getMangata(node);
      const sudo = getSudoUser();

      const users: { nonce: BN; keyPair: KeyringPair }[] = [];
      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      let sudoNonce = await mga.query.getNonce(sudo.keyRingPair.address);
      //lets create as many of users as threads.
      for (let i = 0; i < numberOfThreads; i++) {
        const user = new EthUser(keyring);
        const keyPair = user.keyRingPair;
        const nonce = await mga.query.getNonce(keyPair.address);
        //lets mint some MGA assets to pay fees
        // eslint-disable-next-line no-loop-func
        assets.forEach((assetId) => {
          mintPromises.push(
            mintAsset(
              sudo.keyRingPair,
              assetId,
              user,
              new BN(10).pow(new BN(30)),
              sudoNonce,
            ),
          );
          sudoNonce = sudoNonce.addn(1);
        });
        users.push({ nonce: nonce, keyPair: keyPair });
      }
      this.mgaNodeandUsers.set(nodeNumber, { mgaSdk: mga, users: users });
    }
    testLog.getLog().info("Waiting for mining tokens");
    testLog.getLog().debug(JSON.stringify(this.mgaNodeandUsers.get(0) as any));
    await Promise.all(mintPromises);
    testLog.getLog().info("¡¡ Tokens minted !!");

    return true;
  }
  async mintERC20TokensToUsers(
    tokenIds: number[],
    mgaNodeandUsers: Map<
      number,
      { mgaSdk: MangataInstance; users: { nonce: BN; keyPair: KeyringPair }[] }
    >,
  ) {
    const keyring = new Keyring({ type: "ethereum" });
    const mintPromises = [];

    for (let nodeNumber = 0; nodeNumber < mgaNodeandUsers.size; nodeNumber++) {
      const mga = mgaNodeandUsers.get(nodeNumber)?.mgaSdk!;
      const users = mgaNodeandUsers.get(nodeNumber)?.users!;
      const mgaNode = new Node(mga.util.getUrls()[0]);
      const sudo = UserFactory.createUser(Users.SudoUser, keyring, mgaNode);

      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      let sudoNonce = await mga.query.getNonce(sudo.keyRingPair.address);
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
              sudoNonce,
            ),
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
    const keyring = new Keyring({ type: "ethereum" });
    for (let nodeNumber = 0; nodeNumber < nodes.length; nodeNumber++) {
      const node = nodes[nodeNumber];
      const mga = await getMangata(node);
      const users: { nonce: BN; keyPair: KeyringPair }[] = [];
      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      //lets create as many of users as threads.
      for (let i = 0; i < numberOfThreads; i++) {
        const stringSeed = createUserSequentially();
        const keyPair = keyring.addFromUri(stringSeed);
        const nonce = await mga.query.getNonce(keyPair.address);
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
      { mgaSdk: MangataInstance; users: { nonce: BN; keyPair: KeyringPair }[] }
    >,
  ) {
    const transferPromises = [];

    for (let nodeNumber = 0; nodeNumber < mgaNodeandUsers.size; nodeNumber++) {
      const mga = mgaNodeandUsers.get(nodeNumber)?.mgaSdk!;
      const users = mgaNodeandUsers.get(nodeNumber)?.users!;

      testLog.getLog().info("Fetching nonces for node " + nodeNumber);
      let userNonce = await mga.query.getNonce(user.keyRingPair.address);
      //lets create as many of users as threads.
      for (let i = 0; i < users.length; i++) {
        transferPromises.push(
          transferAsset(
            user.keyRingPair,
            new BN(liqAssetId),
            users[i].keyPair.address,
            amount,
          ),
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
  const mga = Mangata.instance([node]);
  const api = await initApi(node);
  await api.isReady;
  return mga;
}
