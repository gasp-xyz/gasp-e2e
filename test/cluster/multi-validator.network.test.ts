/*
 * @group multi-validator
 *
 * eslint-disable no-loop-func
 * eslint-disable no-console
 */
import BN from "bn.js";
import {uniq, intersection, takeRight} from "lodash";

import {cryptoWaitReady} from "@polkadot/util-crypto";
import {Keyring} from "@polkadot/api";

import {SudoUser} from "../../utils/Framework/User/SudoUser";
import {UserFactory, Users} from "../../utils/Framework/User/UserFactory";
import {Node} from "../../utils/Framework/Node/Node";
import {testLog} from "../../utils/Logger";
import {getEnvironmentRequiredVars, waitForNBlocks} from "../../utils/utils";
import {GovernanceUser} from "../../utils/Framework/User/GovernanceUser";
import {Bank} from "../../utils/Framework/Supply/Bank";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let bootnodeA: Node;
let bootnodeB: Node;
let keyring: Keyring;
let sudo: SudoUser;

const RelayOne: Node = new Node(getEnvironmentRequiredVars().relayOne);
const RelayTwo: Node = new Node(getEnvironmentRequiredVars().relayTwo);
const CollatorOne: Node = new Node(getEnvironmentRequiredVars().collatorOne);
const CollatorTwo: Node = new Node(getEnvironmentRequiredVars().collatorTwo);

const nodes = [
  RelayOne,
  RelayTwo,
  CollatorOne,
  CollatorTwo,
];

beforeAll(async () => {
  await cryptoWaitReady(); // Wait for Polkadots WASM backend

  try {
    Promise.all([
      await RelayOne.connect(),
      await RelayTwo.connect(),
      await CollatorOne.connect(),
      await CollatorTwo.connect(),
    ]);

    nodes.forEach((node) => {
      node.subscribeToHead();
    });
  } catch (e) {
    throw e;
  }

  bootnodeA = RelayOne;
  await bootnodeA.connect();
  await bootnodeA.subscribeToHead();

  bootnodeB = RelayTwo;
  await bootnodeB.connect();
  await bootnodeB.subscribeToHead();

  keyring = new Keyring({type: "sr25519"});
  sudo = UserFactory.createUser(Users.SudoUser, keyring, bootnodeA) as SudoUser;
});

afterAll(async () => {
  Promise.all([
    RelayOne.stop(),
    RelayTwo.stop(),
    CollatorOne.stop(),
    CollatorTwo.stop(),
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
      Math.random() * (RelayOne.lastBlock! - RelayOne.firstBlock! + 1) +
      RelayOne.firstBlock!
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

    nodes.map(async (node: Node) => {
      const blocks = takeRight(Array.from(node.blockAuthors), 3);
      blocks.forEach((block) => {
        blockProducer.add(block!);
      });
    });

    expect(blockProducer.size).toEqual(2);
  });

  test("Extrinsics propogate correctly", async () => {
    const candidate = UserFactory.createUser(
      Users.GovernanceUser,
      keyring,
      bootnodeA
    ) as GovernanceUser;

    const voter = UserFactory.createUser(
      Users.GovernanceUser,
      keyring,
      bootnodeB
    ) as GovernanceUser;

    const bank = new Bank(sudo);

    await voter.addMGATokens(
      bank.sudoUser,
      new BN(Math.pow(10, 17).toString())
    );
    await candidate.addMGATokens(
      bank.sudoUser,
      new BN(Math.pow(10, 16).toString())
    );

    candidate.node.subscribeToUserBalanceChanges(candidate);
    voter.node.subscribeToUserBalanceChanges(voter);

    const candidatesAddress = candidate.keyRingPair.address;

    await candidate.runForCouncil();
    await voter.vote([candidate], new BN(Math.pow(10, 16).toString()));
    await waitForNBlocks(2);

    const termZeroNodeA = getLastBlocksElectionData(bootnodeA);
    const termZeroNodeB = getLastBlocksElectionData(bootnodeB);

    expect(flattenArray(termZeroNodeA.Candidates)).toEqual(
      expect.arrayContaining([candidatesAddress])
    );

    expect(flattenArray(termZeroNodeB.Candidates)).toEqual(
      expect.arrayContaining([candidatesAddress])
    );
  });
});

function getLastBlocksElectionData(node: Node) {
  const electionData = node.electionEvents.get(node.lastBlock! - 1);

  return {
    Members: electionData!.members,
    Candidates: electionData!.candidates,
  };
}

function flattenArray(arr: [any]) {
  return arr.reduce((acc, val) => acc.concat(val), []);
}
