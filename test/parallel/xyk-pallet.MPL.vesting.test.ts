/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import { createPoolIfMissing } from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { getBlockNumber, getEnvironmentRequiredVars } from "../../utils/utils";
import { Node } from "../../utils/Framework/Node/Node";
import { BN, BN_HUNDRED_THOUSAND } from "@mangata-finance/sdk";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { RegularUser } from "../../utils/Framework/User/RegularUser";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: RegularUser;
let sudo: SudoUser;
let keyring: Keyring;
let createdToken: BN;

describe("Vesting", () => {
  beforeAll(async () => {
    keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    // setup users
    testUser1 = UserFactory.createUser(Users.RegularUser, keyring, node);
    sudo = new SudoUser(keyring, node);
    const block = await getBlockNumber();
    const result = await testUser1
      .withTokens([MGA_ASSET_ID])
      .withFn(
        node.api!.tx.sudo.sudo(
          node.api!.tx.vesting.forceVestedTransfer(
            0,
            sudo.keyRingPair.address,
            testUser1.keyRingPair.address,
            {
              locked: BN_HUNDRED_THOUSAND,
              perBlock: new BN(BN_HUNDRED_THOUSAND).divn(1000),
              startingBlock: block + 1000,
            }
          )
        )
      )
      .withFn(
        node.api!.tx.sudo.sudo(
          node.api!.tx.tokens.create(
            testUser1.keyRingPair.address,
            new BN(Math.pow(10, 20).toString())
          )
        )
      )
      .sudoBatch(sudo);
    createdToken = new BN(
      result.filter((x) => x.event.method === "Issued")[0].eventData[0]
        .data as any
    );
    await createPoolIfMissing(
      sudo,
      BN_HUNDRED_THOUSAND.muln(2).toString(),
      MGA_ASSET_ID,
      createdToken,
      true
    );
  });

  test("As a user, I can use vested tokens to mint", async () => {
    //TODO: Continue here
  });
});
