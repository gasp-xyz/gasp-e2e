/* eslint-disable no-console */
import { initApi } from "./api";
import { getAllNodesLatestHash } from "./queries";
import { Node } from "./types";

const alice: Node = { name: "Alice" };
const bob: Node = { name: "Bob" };
const charlie: Node = { name: "Charlie" };
const dave: Node = { name: "Dave" };
const eve: Node = { name: "Eve" };
const ferdie: Node = { name: "Ferdie" };

let nodes: Node[];

async function connectApis(): Promise<void> {
  console.log("Starting to connect to nodes...");

  alice.api = await initApi("ws://node_alice:9944");
  bob.api = await initApi("ws://node_bob:9944");
  charlie.api = await initApi("ws://node_charlie:9944");
  dave.api = await initApi("ws://node_dave:9944");
  eve.api = await initApi("ws://node_eve:9944");
  ferdie.api = await initApi("ws://node_ferdie:9944");

  nodes = [alice, bob, charlie, dave, eve, ferdie];

  console.log("Connected!");
}

async function main(): Promise<void> {
  await connectApis();

  await getAllNodesLatestHash(nodes);
}

main()
  .catch(console.error)
  .finally(() => process.exit());
