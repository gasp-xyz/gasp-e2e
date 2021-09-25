/*
 * @group cluster
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { uniq, intersection, takeRight } from "lodash";

import { Node } from "../../utils/cluster/Node";
import { testLog } from "../../utils/Logger";
import { waitForNBlocks } from "../../utils/utils";
import { Convert } from "../../utils/Config";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const json = `
  { 
    "id": 1, 
    "mangata_nodes": [ 
      { 
        "name": "Alice", 
        "wsPath": "ws://node_alice:9944" 
      },
      { 
        "name": "Bob", 
        "wsPath": "ws://node_bob:9944" 
      },
      { 
        "name": "Charlie", 
        "wsPath": "ws://node_charlie:9944" 
      },
      { 
        "name": "Dave", 
        "wsPath": "ws://node_dave:9944" 
      },
      { 
        "name": "Eve", 
        "wsPath": "ws://node_eve:9944" 
      },
      { 
        "name": "Ferdie", 
        "wsPath": "ws://node_ferdie:9944" 
      }
    ]
  }`;

const nodes: Node[] = new Array<Node>();

beforeAll(async () => {
  Convert.toTestConfig(json).mangata_nodes.forEach((arr) => {
    nodes.push(new Node(arr.name, arr.wsPath));
  });

  Promise.all([nodes.map((node) => node.connect())]).catch((err) =>
    testLog.getLog().error(err)
  );
  Promise.all([nodes.map((node) => node.subscribeToHead())]).catch((err) =>
    testLog.getLog().error(err)
  );
});

afterAll(async () => {
  Promise.all([nodes.map((node) => node.stop())]).catch((err) =>
    testLog.getLog().error(err)
  );
});

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
