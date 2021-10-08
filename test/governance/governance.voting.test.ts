/*
 * @group governance
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */

import { difference } from "lodash";

import { ElectionState, Node } from "../../utils/cluster/Node";
import { testLog } from "../../utils/Logger";
import { waitForNBlocks } from "../../utils/utils";
import { Convert } from "../../utils/Config";
import { vote } from "../../utils/governance/election";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { fold } from "fp-ts/lib/Either";
import { KeyNotFoundError } from "../../utils/Errors";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const json = `
  { 
    "id": 1, 
    "mangata_nodes": [ 
      { 
        "name": "Node A", 
        "wsPath": "wss://develop.mangatafinance.cloud:9944" 
      },
      { 
        "name": "Node B", 
        "wsPath": "wss://develop.mangatafinance.cloud:9945" 
      },
      { 
        "name": "Node C", 
        "wsPath": "wss://develop.mangatafinance.cloud:9946" 
      }
    ]
  }`;

const nodes: Node[] = new Array<Node>();
let masterNode: Node;

beforeAll(async () => {
  Convert.toTestConfig(json).mangata_nodes.forEach((arr) => {
    nodes.push(new Node(arr.name, arr.wsPath));
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

  masterNode = nodes[0];
});

afterAll(async () => {
  await Promise.all([nodes.map(async (node) => await node.stop())]).catch(
    (err) => testLog.getLog().error(err)
  );
});

describe("Governance -> Voting", () => {
  test("Users can vote", async () => {
    // Pick candidates
    const selectedCandidates: number[] = [123, 456];
    const user = new User(new Keyring());

    vote(user, selectedCandidates);
    await waitForNBlocks(3);

    // Get candidate list at last block
    const candidateList: number[] = [1, 2, 3];

    fold(
      (err: KeyNotFoundError) => {
        throw err;
      },
      (electionState: ElectionState) => {
        testLog.getLog().info(electionState.candidates);
      }
    )(masterNode.getElectionStateByBlockHash(masterNode.lastHash!));

    // Verify subset in superset
    expect(difference(selectedCandidates, candidateList).length).toEqual(0);
  });
});
