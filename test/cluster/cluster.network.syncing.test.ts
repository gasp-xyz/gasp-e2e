/*
 * @group cluster
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { intersection } from "lodash";
import { spawn, Worker } from "threads";

import { initApi } from "../../utils/api";
import { NodeWorker } from "../../utils/cluster/workers/nodeWorker";
import { Node } from "../../utils/cluster/types";

import {
  getEnvironmentRequiredVars,
  repeatOverNBlocks,
  waitForNBlocks,
} from "../../utils/utils";

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

const nodeWorkerPath = "../../utils/cluster/workers/nodeWorker";

const alice  : Node = { name: "Alice"   };
const bob    : Node = { name: "Bob"     };
const charlie: Node = { name: "Charlie" };
const dave   : Node = { name: "Dave"    };
const eve    : Node = { name: "Eve"     };
const ferdie : Node = { name: "Ferdie"  };

let nodes: Node[];

beforeAll(async () => {
  try {
    alice.api      = await initApi(clusterNodeA);
    alice.worker   = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    bob.api        = await initApi(clusterNodeB);
    bob.worker     = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    charlie.api    = await initApi(clusterNodeC);
    charlie.worker = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    dave.api       = await initApi(clusterNodeD);
    dave.worker    = await spawn<NodeWorker>(new Worker(nodeWorkerPath));
 
    eve.api        = await initApi(clusterNodeE);
    eve.worker     = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    ferdie.api     = await initApi(clusterNodeF);
    ferdie.worker  = await spawn<NodeWorker>(new Worker(nodeWorkerPath));

    nodes = [alice, bob, charlie, dave, eve, ferdie];
  } catch (e) {
    throw e;
  }
});

describe("Cluster -> Network -> Syncing", () => {
  test("Cluster does not fork", async () => {
    type NodeName     = String;
    type Hash         = String
    type Hashes       = Set<Hash>
    type KVNodeHashes = Map<NodeName, Hashes>;

    const nodeHashes: KVNodeHashes = new Map();

    waitForNBlocks(10);

    repeatOverNBlocks(3)(() => {
      nodes.map(async (node) =>
        nodeHashes.set(
          node.name,
          nodeHashes.get(node.name)!.add((await node.worker?.getHash(node))!)
        )
      );
    });

    expect(
      intersection(Array.from(nodeHashes.values())).length
    ).toBeGreaterThan(0);
  });
});
