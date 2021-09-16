/*
 * @group cluster
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import { intersection } from "lodash";

import { initApi } from "../../utils/api";
import { getLastBlockHash } from "../../utils/cluster/queries";
import { Node } from "../../utils/cluster/types";
import { waitNewBlock } from "../../utils/eventListeners";

const alice: Node = { name: "Alice" };
const bob: Node = { name: "Bob" };
const charlie: Node = { name: "Charlie" };
const dave: Node = { name: "Dave" };
const eve: Node = { name: "Eve" };
const ferdie: Node = { name: "Ferdie" };

let nodes: Node[];

beforeAll(async () => {
  try {
    alice.api = await initApi("ws://node_alice:9944");
    bob.api = await initApi("ws://node_bob:9944");
    charlie.api = await initApi("ws://node_charlie:9944");
    dave.api = await initApi("ws://node_dave:9944");
    eve.api = await initApi("ws://node_eve:9944");
    ferdie.api = await initApi("ws://node_ferdie:9944");

    nodes = [alice, bob, charlie, dave, eve, ferdie];
  } catch (e) {
    throw e;
  }
});

describe("Cluster -> Network -> Syncing", () => {
  test("Cluster does not fork", async () => {
    const nodeHashes = [new Set<string>()];

    const blocksToWait = 3;
    for (let i = 0; i < blocksToWait; i++) {
      nodes.forEach(async (node) => {
        nodeHashes[i].add(await getLastBlockHash(node));
      });

      waitNewBlock();
    }

    expect(intersection(nodeHashes).length).toBeGreaterThan(0);
  });
});
