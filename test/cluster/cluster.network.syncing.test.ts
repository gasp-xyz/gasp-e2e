/*
 * @group cluster
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { forEachRight, intersection, takeRight } from "lodash";

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

const alice: Node = new Node("Alice");
const bob: Node = new Node("Bob");
const charlie: Node = new Node("Charlie");
const dave: Node = new Node("Dave");
const eve: Node = new Node("Eve");
const ferdie: Node = new Node("Ferdie");

let nodes: Node[];

beforeAll(async () => {
  try {
    await alice.connect(clusterNodeA);
    alice.start();

    await bob.connect(clusterNodeB);
    bob.start();

    await charlie.connect(clusterNodeC);
    charlie.start();

    await dave.connect(clusterNodeD);
    dave.start();

    await eve.connect(clusterNodeE);
    eve.start();

    await ferdie.connect(clusterNodeF);
    ferdie.start();

    nodes = [alice, bob, charlie, dave, eve, ferdie];
  } catch (e) {
    throw e;
  }
});

afterAll(async () => {
  await alice.stop();
  await bob.stop();
  await charlie.stop();
  await dave.stop();
  await eve.stop();
  await ferdie.stop();
});

describe("Cluster -> Network -> Syncing", () => {
  test("Cluster does not fork", async () => {
    const nodeHashMap: Map<string, Set<string>> = new Map();

    await waitForNBlocks(5);

    nodes.map(async (node) => {
      const hashes = takeRight(Array.from(node.hashes.values()), 3);
      testLog.getLog().info(`${node.name}'s Hashes: ${hashes}`);
      nodeHashMap.set(node.name, new Set(hashes));
    });

    expect(
      intersection(Array.from(nodeHashMap.values())).length
    ).toBeGreaterThan(0);
  });
});
