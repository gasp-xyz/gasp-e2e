/*
 * @group governance-candidacy
 */

import BN from "bn.js";
import { GovernanceUser } from "../../utils/Framework/User/GovernanceUser";
import { Keyring } from "@polkadot/api";
import { Bank } from "../../utils/Framework/Supply/Bank";
import { Node } from "../../utils/Framework/Node/Node";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";

const { chainUri: environmentUri } = getEnvironmentRequiredVars();
let termDuration: number; // Set as a const in mangata-node
const termBlockDelta = 3; // A small block delta at term boundaries

let bootnode: Node;
let keyring: Keyring;
let sudo: SudoUser;

let candidate: GovernanceUser;
let voter: GovernanceUser;
let bank: Bank;

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(15000000);

beforeAll(async () => {
  await cryptoWaitReady(); // Wait for Polkadots WASM backend

  bootnode = new Node(environmentUri);
  await bootnode.connect();
  await bootnode.subscribeToHead();

  termDuration = (
    await bootnode.api!.derive.elections.info()
  ).termDuration.toNumber();

  keyring = new Keyring({ type: "sr25519" });
  sudo = UserFactory.createUser(Users.SudoUser, keyring, bootnode) as SudoUser;
});

beforeEach(async () => {
  // Don't run tests at the end of a term
  if (termDuration % bootnode.lastBlock! >= 45) {
    waitForNextTerm();
  }

  // Initialize actors
  candidate = UserFactory.createUser(
    Users.GovernanceUser,
    keyring,
    bootnode
  ) as GovernanceUser;
  voter = UserFactory.createUser(
    Users.GovernanceUser,
    keyring,
    bootnode
  ) as GovernanceUser;
  bank = new Bank(sudo);

  // Fund accounts
  await voter.addMGATokens(bank.sudoUser, new BN(Math.pow(10, 17).toString()));
  await candidate.addMGATokens(
    bank.sudoUser,
    new BN(Math.pow(10, 16).toString())
  );

  // Subscribe to events
  candidate.node.subscribeToUserBalanceChanges(candidate);
  voter.node.subscribeToUserBalanceChanges(voter);
});

describe("Governance -> Candidacy -> Users", () => {
  test("User can run for candidacy", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    await candidate.runForCouncil();
    await waitForNBlocks(2);

    const candidates = getLastBlocksElectionData();

    expect(candidates).toEqual(expect.arrayContaining([candidatesAddress]));
  });

  test("Candidate can renounce candidacy", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    await candidate.runForCouncil();
    await waitForNBlocks(2);
    const candidateStatus = { Candidate: 1 };
    await candidate.renounceCandidacy(candidateStatus);
    await waitForNBlocks(2);

    const candidates = getLastBlocksElectionData();

    expect(candidates).not.toEqual(expect.arrayContaining([candidatesAddress]));
  });

  test("Council Member can renounce candidacy", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    // Gonzalo runs for Council in Term 0
    // Eddy votes for Gonzalo
    await candidate.runForCouncil();
    await voter.vote([candidate], new BN(Math.pow(10, 16).toString()));
    await waitForNBlocks(2);

    const candidatesTerm0 = getLastBlocksElectionData();

    expect(candidatesTerm0).toEqual(
      expect.arrayContaining([candidatesAddress])
    );

    // Gonzalo wins the election and is council member!
    // Gonzalo subsequently renounces candidacy in Term 1
    await waitForNextTerm();
    //FIX this, the candidate is a member at this point!!
    const candidates = getLastBlocksElectionData();
    expect(candidates).toEqual(expect.arrayContaining([candidatesAddress]));

    const candidateStatus = { Member: candidate.keyRingPair.address };
    await candidate.renounceCandidacy(candidateStatus);

    // Gonzalo is not automatically running for candidacy in Term 2
    await waitForNextTerm();

    const candidatesTerm2 = getLastBlocksElectionData();

    expect(candidatesTerm2).not.toEqual(
      expect.arrayContaining([candidatesAddress])
    );
  });

  test("Council Member automatically runs for candidacy again", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    // Gonzalo runs for Council in Term 0
    // Eddy votes for Gonzalo
    await candidate.runForCouncil();
    await voter.vote([candidate], new BN(Math.pow(10, 16).toString()));

    await waitForNBlocks(2);

    const candidatesTerm0 = getLastBlocksElectionData();
    expect(candidatesTerm0).toEqual(
      expect.arrayContaining([candidatesAddress])
    );

    // Gonzalo wins the election and is a council member!
    await waitForNextTerm();

    const candidatesTerm1 = getLastBlocksElectionData();

    expect(candidatesTerm1).toEqual(
      expect.arrayContaining([candidatesAddress])
    );

    // Gonzalo is automatically running for candidacy in Term 2
    await waitForNextTerm();

    const candidatesTerm2 = getLastBlocksElectionData();

    expect(candidatesTerm2).not.toEqual(
      expect.arrayContaining([candidatesAddress])
    );
  });
});

async function waitForNextTerm() {
  // Blocks per term are 50 on the modified mangata node
  // We know the last block, so we can work out our position in the term
  // as lastBlock % blocksPerTerm. We wait an additional 3 blocks purely to avoid
  // tests needing to manually wait a few extra blocks too.
  const blocksPerTerm = termDuration;
  const lastBlock = bootnode.lastBlock!;
  const blocksToWait =
    blocksPerTerm - (lastBlock % blocksPerTerm) + termBlockDelta;
  await waitForNBlocks(blocksToWait);
}

function getLastBlocksElectionData() {
  const electionData = bootnode.electionEvents.get(bootnode.lastBlock! - 1);
  const candidates = electionData?.candidates;

  return candidates;
}
