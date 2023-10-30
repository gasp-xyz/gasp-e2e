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

// Global variables
const { chainUri: environmentUri } = getEnvironmentRequiredVars();
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(15000000);

// Chain variables
let bootnode: Node;
let keyring: Keyring;
let sudo: SudoUser;
let termDuration: number; // Set as a const in mangata-node
const termBlockDelta = 3; // A small block delta at term boundaries

// Test variables
let candidate: GovernanceUser;
let voter: GovernanceUser;
let bank: Bank;
const stakeAmount = new BN(Math.pow(10, 16).toString());
const accountFundingAmount = new BN(Math.pow(10, 17).toString());

// Cross-test state
const state: {
  accounts: [GovernanceUser | null];
} = { accounts: [null] };

beforeAll(async () => {
  await cryptoWaitReady(); // Wait for Polkadots WASM backend

  // Instantiate nodes
  bootnode = new Node(environmentUri);
  await bootnode.connect();
  await bootnode.subscribeToHead();

  // Set chain variables
  termDuration =
    (await bootnode.api!.derive.elections.info())!.termDuration!.toNumber();
  keyring = new Keyring({ type: "sr25519" });
  sudo = UserFactory.createUser(Users.SudoUser, keyring, bootnode) as SudoUser;
});

beforeEach(async () => {
  // Don't run tests at the end of a term
  if (termDuration % bootnode.lastBlock!) {
    waitForNextTerm();
  }

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

  // Record new test state
  state.accounts.push(voter);

  // Fund accounts
  await voter.addMGATokens(bank.sudoUser, accountFundingAmount);
  await candidate.addMGATokens(bank.sudoUser, stakeAmount);

  // Subscribe to events
  candidate.node.subscribeToUserBalanceChanges(candidate);
  voter.node.subscribeToUserBalanceChanges(voter);
});

afterAll(async () => {
  // Tests in files are unlikely to impact each other
  // but not clearing up over multiple test files will break
  await cleanState();

  // Stops duplicated bootnode subscriptions creating duplicate logs
  await bootnode.stop();
});

describe("Governance -> Candidacy -> Users", () => {
  test("User can run for candidacy", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    await candidate.runForCouncil();
    await waitForNBlocks(2);

    const termZero = getLastBlocksElectionData();

    expect(flattenArray(termZero.Candidates)).toEqual(
      expect.arrayContaining([candidatesAddress]),
    );
  });

  test("Candidate can renounce candidacy", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    await candidate.runForCouncil();
    await waitForNBlocks(2);

    await candidate.renounceCandidacy({ Candidate: 1 });

    await waitForNBlocks(2);

    const termZero = getLastBlocksElectionData();

    expect(flattenArray(termZero.Candidates)).not.toEqual(
      expect.arrayContaining([candidatesAddress]),
    );
  });

  test("Council Member can renounce candidacy", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    // Gonzalo runs for Council in Term 0
    // Eddy votes for Gonzalo
    await candidate.runForCouncil();
    await voter.vote([candidate], stakeAmount);
    await waitForNBlocks(2);

    const termZero = getLastBlocksElectionData();

    expect(flattenArray(termZero.Candidates)).toEqual(
      expect.arrayContaining([candidatesAddress]),
    );

    // Gonzalo wins the election and is council member!
    // Gonzalo subsequently renounces candidacy in Term 1
    await waitForNextTerm();

    const termOne = getLastBlocksElectionData();
    expect(flattenArray(termOne.Members)).toEqual(
      expect.arrayContaining([candidatesAddress]),
    );

    const candidateStatus = { Member: candidate.keyRingPair.address };
    await candidate.renounceCandidacy(candidateStatus);

    // Gonzalo is not automatically running for candidacy in Term 2
    await waitForNextTerm();

    const termTwo = getLastBlocksElectionData();

    expect(flattenArray(termTwo.Candidates)).not.toEqual(
      expect.arrayContaining([candidatesAddress]),
    );
  });

  test("Council Member automatically runs for candidacy again", async () => {
    const candidatesAddress = candidate.keyRingPair.address;

    // Gonzalo runs for Council in Term 0
    // Eddy votes for Gonzalo
    await candidate.runForCouncil();
    await voter.vote([candidate], stakeAmount);

    await waitForNBlocks(2);

    const termZero = getLastBlocksElectionData();
    expect(flattenArray(termZero.Candidates)).toEqual(
      expect.arrayContaining([candidatesAddress]),
    );

    // Gonzalo wins the election and is a council member!
    await waitForNextTerm();

    const termOne = getLastBlocksElectionData();

    expect(flattenArray(termOne.Members)).toEqual(
      expect.arrayContaining([candidatesAddress]),
    );

    // Gonzalo is automatically running for candidacy in Term 2
    await waitForNextTerm();

    const termTwo = getLastBlocksElectionData();

    expect(flattenArray(termTwo.Candidates)).not.toEqual(
      expect.arrayContaining([candidatesAddress]),
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

  return {
    Members: electionData!.members,
    Candidates: electionData!.candidates,
  };
}

function flattenArray(arr: [any]) {
  return arr.reduce((acc, val) => acc.concat(val), []);
}

async function cleanState() {
  state.accounts.forEach(async (account) => {
    if (account !== null) {
      // Force clean state
      try {
        const candidateStatus = { Member: account.keyRingPair.address };
        await account?.renounceCandidacy(candidateStatus);
      } catch (e) {}
      try {
        const candidateStatus = { Candidate: 0 };
        await account?.renounceCandidacy(candidateStatus);
      } catch (e) {}
    }
  });
  await waitForNextTerm();
}
