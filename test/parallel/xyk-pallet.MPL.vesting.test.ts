/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import {
  createPoolIfMissing,
  getLiquidityAssetId,
  getUserAssets,
} from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  getBlockNumber,
  getEnvironmentRequiredVars,
  getMultiPurposeLiquidityStatus,
} from "../../utils/utils";
import { Node } from "../../utils/Framework/Node/Node";
import { BN, BN_HUNDRED_THOUSAND } from "@mangata-finance/sdk";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { RegularUser } from "../../utils/Framework/User/RegularUser";
import { hexToBn } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: RegularUser;
let sudo: SudoUser;
let keyring: Keyring;
let createdToken: BN;
const vestedTokenAmount = new BN("9000000000000000000000");

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
              locked: vestedTokenAmount,
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
    await testUser1.mintLiquidityWithVestedTokens(
      BN_HUNDRED_THOUSAND,
      createdToken
    );
    const liqToken = await getLiquidityAssetId(MGA_ASSET_ID, createdToken);
    const balances = await getUserAssets(testUser1.keyRingPair.address, [
      liqToken,
      MGA_ASSET_ID,
    ]);
    expect(balances[0].frozen).bnEqual(
      vestedTokenAmount.sub(balances[1].frozen)
    );
    expect(balances[0].frozen).bnEqual(BN_HUNDRED_THOUSAND);
    const liqTokenStatus = await getMultiPurposeLiquidityStatus(
      testUser1.keyRingPair.address,
      liqToken
    );
    const allZeroes = Object.values(JSON.parse(liqTokenStatus)).every(
      (val) => val === 0
    );
    expect(allZeroes).toBeFalsy();
    expect(hexToBn(liqTokenStatus.stakedUnactivatedReserves)).bnEqual(
      new BN(0)
    );
    expect(hexToBn(liqTokenStatus.activatedUnstakedReserves)).bnEqual(
      BN_HUNDRED_THOUSAND
    );
    expect(hexToBn(liqTokenStatus.stakedAndActivatedReserves)).bnEqual(
      new BN(0)
    );
    expect(hexToBn(liqTokenStatus.unspentReserves)).bnEqual(new BN(0));
    expect(hexToBn(liqTokenStatus.relockAmount)).bnEqual(new BN(0));
  });
});
