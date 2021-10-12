/* eslint-disable @typescript-eslint/no-unused-vars */
import { resolve } from "path";

import { Network } from "../../utils/cluster/Network";
import { Node } from "../../utils/cluster/Node";
import { User } from "../../utils/cluster/User";
import { Token } from "../../utils/cluster/Token";

let network: Network;
let users: Array<User>;
let nodes: Array<Node>;
let tokens: Array<Token>;

beforeAll(async () => {
  network = new Network();
  await network.init(resolve(__dirname, "./governance.config"));
  users = network.getState().users!;
  nodes = network.getState().nodes!;
  tokens = network.getState().tokens!;
});

beforeEach(() => {
  network.prettyPrintState();
});

describe("Governance -> Voting -> Users", () => {
  test("Users can vote for a new council", () => {});
});
