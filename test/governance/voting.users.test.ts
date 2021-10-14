/* eslint-disable @typescript-eslint/no-unused-vars */

import BN from "bn.js";
import { GovernanceUser } from "../../utils/Framework/User/GovernanceUser";
import { Keyring } from "@polkadot/api";
import { Network } from "../../utils/Framework/Network";
import { Node } from "../../utils/Framework/Node/Node";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Token } from "../../utils/Framework/Token";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";

let bootnode: Node;
let keyring: Keyring;
let sudo: SudoUser;

beforeAll(async () => {
  bootnode = new Node("wss://develop.mangatafinance.cloud:9944");
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

    const network = new Network(keyring, bootnode, [bootnode], sudo, [
      candidate,
      voter,
    ]);

    const mgaToken: Token = await sudo.mintToken(new BN(10000000));

    sudo.fundUser(candidate, mgaToken, new BN(10000));
    sudo.fundUser(voter, mgaToken, new BN(10000));

    await candidate.runForCouncil();
    await voter.vote([candidate], 5000);
  });
});
