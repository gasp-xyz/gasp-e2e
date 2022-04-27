/*
 * @group cluster-healthcheck
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { uniq, intersection, takeRight } from "lodash";

import { Node } from "../../utils/cluster/Node";
import { testLog } from "../../utils/Logger";
import {
  getEnvironmentRequiredVars,
  waitForNBlocks,
  waitForNBlocksAndMEasureTime,
} from "../../utils/utils";
import { waitForAtLeastNCollators } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const nodes: Node[] = new Array<Node>();

beforeAll(async () => {
  const { clusters } = getEnvironmentRequiredVars();
  JSON.parse(clusters).forEach((url: string) => {
    nodes.push(new Node(`Cluster[${url}]`, url));
  });

  const promises = [];
  for (let index = 0; index < nodes.length; index++) {
    const element = nodes[index];
    promises.push(element.connect());
  }
  await Promise.all(promises);

  for (let index = 0; index < nodes.length; index++) {
    const element = nodes[index];
    promises.push(element.subscribeToHead());
  }
  await Promise.all(promises);
});

afterAll(async () => {
  await Promise.all([nodes.map(async (node) => await node.stop())]).catch(
    (err) => testLog.getLog().error(err)
  );
});

describe("Cluster -> Healthcheck", () => {
  test("Nodes builds in less than 100 secs", async () => {
    const times = await waitForNBlocksAndMEasureTime(5);
    times.forEach((value) => {
      expect(value).toBeLessThan(100 * 1000);
    });
    expect(times.size).toBeGreaterThanOrEqual(5);
  });
  test("At least two collators", async () => {
    const atLeastTwoCollators = await waitForAtLeastNCollators(2, 10);
    expect(atLeastTwoCollators).toBeTruthy();
  });
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

  test("Block numbers match across all nodes", async () => {
    const numberOfBlocksToCheck = 3;
    const nodeBlockMap: Map<string, Set<number>> = new Map();
    await waitForNBlocks(5);

    nodes.map(async (node) => {
      const blockNumbers = takeRight(
        Array.from(node.blockNumbers.values()),
        numberOfBlocksToCheck
      );
      testLog
        .getLog()
        .info(
          `${node.name}'s Last ${numberOfBlocksToCheck} Blocks: ${blockNumbers}`
        );
      nodeBlockMap.set(node.name, new Set(blockNumbers));
    });

    expect(
      intersection(Array.from(nodeBlockMap.values())).length
    ).toBeGreaterThan(0);
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
