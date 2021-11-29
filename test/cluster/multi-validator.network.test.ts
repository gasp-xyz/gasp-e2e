/*
 * @group cluster multi-validator
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { uniq, intersection, takeRight } from "lodash";

import { Node } from "../../utils/cluster/Node";
import { testLog } from "../../utils/Logger";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const ValidatorA: Node = new Node(
  "validatorA",
  getEnvironmentRequiredVars().validatorA
);
const ValidatorB: Node = new Node(
  "validatorB",
  getEnvironmentRequiredVars().validatorB
);
const ValidatorANode1: Node = new Node(
  "validatorANode1",
  getEnvironmentRequiredVars().validatorANode1
);
const ValidatorANode2: Node = new Node(
  "validatorANode2",
  getEnvironmentRequiredVars().validatorANode2
);
const ValidatorBNode1: Node = new Node(
  "validatorBNode1",
  getEnvironmentRequiredVars().validatorBNode1
);
const ValidatorBNode2: Node = new Node(
  "validatorBNode2",
  getEnvironmentRequiredVars().validatorBNode2
);

const nodes = [
  ValidatorA,
  ValidatorB,
  ValidatorANode1,
  ValidatorANode2,
  ValidatorBNode1,
  ValidatorBNode2,
];

beforeAll(async () => {
  try {
    Promise.all([
      await ValidatorA.connect(),
      await ValidatorB.connect(),
      await ValidatorANode1.connect(),
      await ValidatorANode2.connect(),
      await ValidatorBNode1.connect(),
      await ValidatorBNode2.connect(),
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
    ValidatorA.stop(),
    ValidatorB.stop(),
    ValidatorANode1.stop(),
    ValidatorANode2.stop(),
    ValidatorBNode1.stop(),
    ValidatorBNode2.stop(),
  ]);
});

describe("Multi-Validator -> Network -> Syncing", () => {
  test("Nodes are up and syncing", async () => {
    const numberOfHashesToCheck = 2;
    const nodeHashMap: Map<string, Set<string>> = new Map();

    await waitForNBlocks(5);

    nodes.map(async (node) => {
      const hashes = takeRight(
        Array.from(node.hashes.values()),
        numberOfHashesToCheck
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
      Math.random() * (ValidatorA.lastBlock! - ValidatorA.firstBlock! + 1) +
        ValidatorA.firstBlock!
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
      intersection(Array.from(nodeHashMap.values())).length
    ).toBeGreaterThan(0);
  });

  test("Two validators can produce blocks on the same chain", async () => {
    const blockProducer: Set<String> = new Set();

    await waitForNBlocks(10);

    nodes.map(async (node) => {
      const blocks = takeRight(Array.from(node.blocks), 3);
      blocks.forEach((block) => {
        blockProducer.add(block.blockProducer);
      });
    });

    expect(blockProducer.size).toEqual(2);
  });

  test("Extrinsics propogate correctly across a 2N-V-V-2N topology", async () => {});
});
