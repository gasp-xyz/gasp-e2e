/*
 * @group cluster
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { uniq, intersection, takeRight } from "lodash";
import { jest } from "@jest/globals";
import { Node } from "../../utils/cluster/Node";
import { testLog } from "../../utils/Logger";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const {
  clusterNodeA,
  clusterNodeB,
  clusterNodeC,
  clusterNodeD,
  clusterNodeE,
  clusterNodeF,
} = getEnvironmentRequiredVars();

const alice: Node = new Node("Alice", clusterNodeA);
const bob: Node = new Node("Bob", clusterNodeB);
const charlie: Node = new Node("Charlie", clusterNodeC);
const dave: Node = new Node("Dave", clusterNodeD);
const eve: Node = new Node("Eve", clusterNodeE);
const ferdie: Node = new Node("Ferdie", clusterNodeF);

const nodes = [alice, bob, charlie, dave, eve, ferdie];

beforeAll(async () => {
  try {
    Promise.all([
      await alice.connect(),
      await bob.connect(),
      await charlie.connect(),
      await dave.connect(),
      await eve.connect(),
      await ferdie.connect(),
    ]);

    nodes.forEach((node) => {
      node.subscribeToHead();
    });
  } catch (e) {
    throw e;
  }
});

afterAll(async () => {
  Promise.all([
    alice.stop(),
    bob.stop(),
    charlie.stop(),
    dave.stop(),
    eve.stop(),
    ferdie.stop(),
  ]);
});

describe("Cluster -> Network -> Syncing", () => {
  test("Nodes are up and syncing", async () => {
    const numberOfHashesToCheck = 2;
    const nodeHashMap: Map<string, Set<string>> = new Map();

    await waitForNBlocks(5);

    nodes.map(async (node) => {
      const hashes = takeRight(
        Array.from(node.hashes.values()),
        numberOfHashesToCheck,
      );
      testLog.getLog().info(`${node.name}'s Hashes: ${hashes}`);
      nodeHashMap.set(node.name, new Set(hashes));
    });

    nodeHashMap.forEach((hashes) => {
      expect(uniq(Array.from(hashes)).length).toBe(2);
    });
  });

  test("Block merkle hash matches across all nodes", async () => {
    const randomBlockNumber = Math.floor(
      Math.random() * (alice.lastBlock! - alice.firstBlock! + 1) +
        alice.firstBlock!,
    );

    await waitForNBlocks(5);

    const hashes: any = [];

    nodes.forEach((node) => {
      hashes.push(node.blockHashes.get(randomBlockNumber));
    });

    testLog
      .getLog()
      .info(`Node hashes at block ${randomBlockNumber}: ${hashes}`);

    expect(uniq(hashes!).length).toBe(1);
  });

  test("Cluster does not fork", async () => {
    const nodeHashMap: Map<string, Set<string>> = new Map();

    await waitForNBlocks(5);

    nodes.map(async (node) => {
      const hashes = takeRight(Array.from(node.hashes.values()), 3);
      testLog.getLog().info(`${node.name}'s Hashes: ${hashes}`);
      nodeHashMap.set(node.name, new Set(hashes));
    });

    expect(
      intersection(Array.from(nodeHashMap.values())).length,
    ).toBeGreaterThan(0);
  });
});
