//Elections are disabled. Hence, skipping the test
/*
 * @group elections
 */
import { jest } from "@jest/globals";
import { BN } from "@polkadot/util";
import { GovernanceUser } from "../../utils/Framework/User/GovernanceUser";
import { Keyring } from "@polkadot/api";
import { Bank } from "../../utils/Framework/Supply/Bank";
import { Node } from "../../utils/Framework/Node/Node";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";

const { chainUri: environmentUri } = getEnvironmentRequiredVars();

let bootnode: Node;
let keyring: Keyring;
let sudo: SudoUser;

let candidate: GovernanceUser;
let voter: GovernanceUser;
let bank: Bank;

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

beforeAll(async () => {
  await cryptoWaitReady(); // Wait for Polkadots WASM backend

  bootnode = new Node(environmentUri);
  await bootnode.connect();
  await bootnode.subscribeToHead();

  keyring = new Keyring({ type: "ethereum" });
  sudo = UserFactory.createUser(Users.SudoUser, keyring, bootnode) as SudoUser;
});

beforeEach(async () => {
  // Initialize actors
  candidate = UserFactory.createUser(
    Users.GovernanceUser,
    keyring,
    bootnode,
  ) as GovernanceUser;

  voter = UserFactory.createUser(
    Users.GovernanceUser,
    keyring,
    bootnode,
  ) as GovernanceUser;

  bank = new Bank(sudo);

  // Fund accounts
  await voter.addGASPTokens(bank.sudoUser, new BN(Math.pow(10, 17).toString()));
  await candidate.addGASPTokens(
    bank.sudoUser,
    new BN(Math.pow(10, 16).toString()),
  );

  // Subscribe to events
  candidate.node.subscribeToUserBalanceChanges(candidate);
  voter.node.subscribeToUserBalanceChanges(voter);
});

describe("Governance -> Voting -> Users", () => {
  test("Users can vote for a new council member", async () => {
    const stake = new BN(Math.pow(10, 14).toString());

    // Gonzalo runs for council
    // Eddy votes for Gonzalo
    await candidate.runForCouncil();
    await voter.vote([candidate], stake);
    await waitForNBlocks(2);

    // Gonzalo is now listed in the latest blocks candidates list
    const electionCandidates = bootnode.electionEvents.get(
      bootnode.lastBlock! - 1,
    )!.candidates;

    expect(electionCandidates).toEqual(
      expect.arrayContaining([candidate.keyRingPair.address]),
    );

    // Eddy has reserved the voting stake amount in his last transaction
    const votersRecentlyReservedTx = voter.node.userBalancesHistory
      .get(bootnode.lastBlock! - 1)!
      .get(0)!.reserved!;

    expect(stake).bnEqual(votersRecentlyReservedTx);
  });
});
