/* eslint-disable @typescript-eslint/no-unused-vars */
import { resolve } from "path";

import { Network } from "../../utils/cluster/Network";
import { Node } from "../../utils/cluster/Node";
import { User } from "../../utils/cluster/User";
import { Token } from "../../utils/cluster/Token";
import { waitForNBlocks } from "../../utils/utils";

let network: Network;
let bootnode: Node;
let users: Array<User>;
let nodes: Array<Node>;
let tokens: Array<Token>;

beforeAll(async () => {
  network = new Network();
  await network.init(resolve(__dirname, "./governance.config"));
  users = network.getState().users!;
  nodes = network.getState().nodes!;
  tokens = network.getState().tokens!;
  bootnode = nodes[0];
});

beforeEach(() => {
  network.prettyPrintState();
});

describe("Governance -> Voting -> Users", () => {
  test("Users can vote for a new council", async () => {
    const candidate = network.getUser("Gonzalo")!;
    const voter = network.getUser("Eddy")!;

    network.fundUser(candidate, tokens[0], 100000);
    network.fundUser(voter, tokens[0], 100000);

    await candidate.runForCouncil();
    await waitForNBlocks(1);

    await voter.vote([candidate], 10000);
    await waitForNBlocks(1);

    // Check candidate in candidates, need to add typing to candidates object in nodes
  });
});
