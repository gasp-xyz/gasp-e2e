/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import { jest } from "@jest/globals";
import "jest-extended";
import {
  activateLiquidity,
  createPoolIfMissing,
  getLiquidityAssetId,
  getUserAssets,
} from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { hexToBn, BN } from "@polkadot/util";
import {
  getBlockNumber,
  getEnvironmentRequiredVars,
  getMultiPurposeLiquidityStatus,
} from "../../utils/utils";
import { Node } from "../../utils/Framework/Node/Node";
import { BN_HUNDRED_THOUSAND, BN_ZERO } from "@mangata-finance/sdk";
import { UserFactory, Users } from "../../utils/Framework/User/UserFactory";
import { RegularUser } from "../../utils/Framework/User/RegularUser";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: RegularUser;
let sudo: SudoUser;
let keyring: Keyring;
let createdToken: BN;
let node: Node;
const vestedTokenAmount = new BN("9000000000000000000000");

describe("Vesting", () => {
  beforeAll(async () => {
    keyring = new Keyring({ type: "ethereum" });
    node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
  });
  beforeEach(async () => {
    // setup users
    testUser1 = UserFactory.createUser(Users.RegularUser, keyring, node);
    sudo = new SudoUser(keyring, node);
    const block = await getBlockNumber();
    const result = await testUser1
      .withTokens([GASP_ASSET_ID])
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
            },
          ),
        ),
      )
      .withFn(
        node.api!.tx.sudo.sudo(
          node.api!.tx.tokens.create(
            testUser1.keyRingPair.address,
            new BN(Math.pow(10, 20).toString()),
          ),
        ),
      )
      .sudoBatch(sudo);
    createdToken = new BN(
      result.filter((x) => x.event.method === "Created")[0].eventData[0]
        .data as any,
    );
    await createPoolIfMissing(
      sudo,
      BN_HUNDRED_THOUSAND.muln(2).toString(),
      GASP_ASSET_ID,
      createdToken,
      true,
    );
  });

  test("As a user, I can use vested tokens to mint", async () => {
    await testUser1.mintLiquidityWithVestedTokens(
      BN_HUNDRED_THOUSAND,
      createdToken,
    );
    const liqToken = await getLiquidityAssetId(GASP_ASSET_ID, createdToken);
    const balances = await getUserAssets(testUser1.keyRingPair.address, [
      liqToken,
      GASP_ASSET_ID,
    ]);
    expect(balances[0].frozen).bnEqual(
      vestedTokenAmount.sub(balances[1].frozen),
    );
    expect(balances[0].frozen).bnEqual(BN_HUNDRED_THOUSAND);
    const liqTokenStatus = await getMultiPurposeLiquidityStatus(
      testUser1.keyRingPair.address,
      liqToken,
    );
    const allZeroes = Object.values(JSON.parse(liqTokenStatus)).every(
      (val) => val === 0,
    );
    expect(allZeroes).toBeTruthy();
  });
  test("As a user, I can activate vesting-minted tokens only if reserved", async () => {
    await testUser1.mintLiquidityWithVestedTokens(
      BN_HUNDRED_THOUSAND,
      createdToken,
    );
    const liqToken = await getLiquidityAssetId(GASP_ASSET_ID, createdToken);
    const balances = await getUserAssets(testUser1.keyRingPair.address, [
      liqToken,
      GASP_ASSET_ID,
    ]);

    const result = await activateLiquidity(
      testUser1.keyRingPair,
      liqToken,
      balances[0].free,
    );
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toBe(ExtrinsicResult.ExtrinsicFailed);

    await testUser1.reserveVestingLiquidityTokens(liqToken, balances[0].frozen);

    await activateLiquidity(
      testUser1.keyRingPair,
      liqToken,
      balances[0].free,
      "UnspentReserves",
      true,
    );

    const mplStatus = await getMultiPurposeLiquidityStatus(
      testUser1.keyRingPair.address,
      liqToken,
    );
    expect(hexToBn(mplStatus.stakedAndActivatedReserves)).bnEqual(BN_ZERO);
    expect(hexToBn(mplStatus.stakedUnactivatedReserves)).bnEqual(
      new BN(BN_ZERO),
    );
    expect(hexToBn(mplStatus.activatedUnstakedReserves)).bnEqual(
      balances[0].frozen,
    );
    expect(hexToBn(mplStatus.unspentReserves)).bnEqual(new BN(BN_ZERO));
    expect(hexToBn(mplStatus.relockAmount)).bnEqual(balances[0].frozen);
  });
});
