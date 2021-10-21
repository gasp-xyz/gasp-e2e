/*
 * @group governance
 */

import BN from "bn.js";
import { includes } from "lodash";
import { GovernanceUser } from "../../utils/Framework/User/GovernanceUser";
import { Keyring } from "@polkadot/api";
import { Bank } from "../../utils/Framework/Supply/Bank";
import { Node } from "../../utils/Framework/Node/Node";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { testLog } from "../../utils/Logger";

const { chainUri: environmentUri } = getEnvironmentRequiredVars();

let bootnode: Node;
let keyring: Keyring;
let sudo: SudoUser;

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

beforeAll(async () => {
  await cryptoWaitReady(); // Wait for Polkadots WASM backend

  bootnode = new Node(environmentUri);
  await bootnode.connect();
  await bootnode.subscribeToHead();

  keyring = new Keyring({ type: "sr25519" });
  sudo = UserFactory.createUser(Users.SudoUser, keyring, bootnode) as SudoUser;
});

describe("Governance -> Voting -> Users", () => {
  test("Users can vote for a new council", async () => {
    const candidate = UserFactory.createUser(
      Users.GovernanceUser,
      keyring,
      bootnode
    ) as GovernanceUser;

    const voter = UserFactory.createUser(
      Users.GovernanceUser,
      keyring,
      bootnode
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

    await candidate.runForCouncil();
    await voter.vote([candidate], new BN(Math.pow(10, 16).toString()));
    await waitForNBlocks(2);
    const electionInfo = bootnode.electionEvents.get(bootnode.lastBlock! - 1);
    testLog.getLog().info(`Test Info:
    Candidates:  ${electionInfo?.candidates}
    Looking for: ${candidate.keyRingPair.address}`);

    expect(
      includes(electionInfo?.candidates, candidate.keyRingPair.address)
    ).toBe(true);
  });
});
