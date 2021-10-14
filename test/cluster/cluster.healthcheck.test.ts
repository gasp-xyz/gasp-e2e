/*
 * @group cluster-healthcheck
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { uniq, intersection, takeRight } from "lodash";

import * as path from "path";
import { testLog } from "../../utils/Logger";
import { waitForNBlocks } from "../../utils/utils";
import { Network } from "../../utils/Framework/Network";
import { Node } from "../../utils/Framework/Node";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let nodes: Array<Node>;
let network: Network;

beforeAll(async () => {
  const filePath = path.resolve(__dirname, "./cluster-healthcheck.config");

  network = new Network();
  await network.init(filePath);
  nodes = network.getState().nodes!;
});

beforeEach(async () => {
  network.prettyPrintState();
});

afterAll(async () => {});

describe("Cluster -> Healthcheck", () => {
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
      Math.random() * (nodes[0].lastBlock! - nodes[0].firstBlock! + 1) +
        nodes[0].firstBlock!
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
});
