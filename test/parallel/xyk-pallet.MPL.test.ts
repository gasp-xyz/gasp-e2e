/*
 *
 * @group xyk
 * @group liquidity
 * @group parallel
 */
import { jest } from "@jest/globals";
import {
  activateLiquidity,
  deactivateLiquidity,
  getLiquidityAssetId,
  getLiquidityPool,
} from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  getEnvironmentRequiredVars,
  getMultiPurposeLiquidityStatus,
} from "../../utils/utils";
import { Node } from "../../utils/Framework/Node/Node";
import { BN } from "@polkadot/util";
import { hexToBn } from "@polkadot/util";
import { Assets } from "../../utils/Assets";
import { getApi } from "../../utils/api";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: SudoUser;
let keyring: Keyring;
let liqTokenForCandidate: BN;
let liqTokensAmount: BN;

describe("MPL: Delegator", () => {
  beforeEach(async () => {
    keyring = new Keyring({ type: "ethereum" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    // setup users
    testUser1 = new User(keyring);
    sudo = new SudoUser(keyring, node);
    const candidates = JSON.parse(
      JSON.stringify(await node.api?.query.parachainStaking.candidatePool()),
    );

    liqTokenForCandidate = new BN(
      Math.max.apply(
        null,
        candidates.map(
          (t: { liquidityToken: { toNumber: () => any } }) => t.liquidityToken,
        ),
      ),
    );
    const tokens = await getLiquidityPool(liqTokenForCandidate);
    // calculate this amount is crucial to not drop the chain production if new candidates are elected.
    // ( we need existi ones with more points thatn the ones created by the tests)
    const minAmountInCollators = new BN(
      BigInt(
        Math.min.apply(
          Math,
          candidates.map((x: { amount: string | null | undefined }) =>
            hexToBn(x.amount),
          ),
        ),
      ).toString(),
    ).subn(10);
    await sudo.mintTokens(
      tokens.concat([MGA_ASSET_ID, liqTokenForCandidate]),
      [testUser1],
      minAmountInCollators.add(new BN(Math.pow(10, 20).toString())),
    );
    const tokensBeforeJoin =
      await testUser1.getUserTokensAccountInfo(liqTokenForCandidate);
    if (hexToBn(tokensBeforeJoin.reserved).gtn(0)) {
      await deactivateLiquidity(
        testUser1.keyRingPair,
        liqTokenForCandidate,
        hexToBn(tokensBeforeJoin.reserved),
      );
    }
  });

  // result parsing from event does not work properly
  test("join as delegator > verify account balances are reserved +  mpl storage", async () => {
    const tokensBeforeJoin =
      await testUser1.getUserTokensAccountInfo(liqTokenForCandidate);
    const liqtokens = hexToBn(tokensBeforeJoin.free);
    await testUser1.joinAsDelegator(liqTokenForCandidate, liqtokens);

    const mplStatus = await getMultiPurposeLiquidityStatus(
      testUser1.keyRingPair.address,
      liqTokenForCandidate,
    );
    const tokensAfterJoin =
      await testUser1.getUserTokensAccountInfo(liqTokenForCandidate);
    expect(hexToBn(mplStatus.stakedUnactivatedReserves)).bnEqual(liqtokens);
    expect(hexToBn(tokensAfterJoin.reserved)).bnEqual(new BN(liqtokens));

    //free - reserved = 0
    expect(hexToBn(tokensAfterJoin.free)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.activatedUnstakedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.stakedAndActivatedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.unspentReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.relockAmount)).bnEqual(new BN(0));
  });
});

describe("MPL: Collators", () => {
  beforeAll(async () => {
    keyring = new Keyring({ type: "ethereum" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    const api = await getApi();
    const tokenAmount = new BN(
      await api.consts.parachainStaking.minCandidateStk.toString(),
    ).muln(100);
    // setup users
    testUser1 = new User(keyring);
    sudo = new SudoUser(keyring, node);
    //create two tokens + pool + sudo.activateliqtoken
    const results = await Assets.setupUserWithCurrencies(
      testUser1,
      [tokenAmount],
      sudo,
    );
    await testUser1.addMGATokens(sudo, tokenAmount.muln(1000));
    const tokenId = results[0];
    await testUser1.createPoolToAsset(
      tokenAmount,
      tokenAmount,
      MGA_ASSET_ID,
      tokenId,
    );
    liqTokenForCandidate = await getLiquidityAssetId(MGA_ASSET_ID, tokenId);
    await sudo.addStakingLiquidityToken(liqTokenForCandidate);
    liqTokensAmount = hexToBn(
      (await testUser1.getUserTokensAccountInfo(liqTokenForCandidate)).free,
    );
    await testUser1.joinAsCandidate(liqTokenForCandidate, liqTokensAmount);
  });

  test("join as collator > verify account balances are reserved + mpl checks", async () => {
    const mplStatus = await getMultiPurposeLiquidityStatus(
      testUser1.keyRingPair.address,
      liqTokenForCandidate,
    );
    const tokensAfterJoin =
      await testUser1.getUserTokensAccountInfo(liqTokenForCandidate);
    expect(hexToBn(mplStatus.stakedUnactivatedReserves)).bnEqual(
      liqTokensAmount,
    );
    expect(hexToBn(tokensAfterJoin.reserved)).bnEqual(liqTokensAmount);

    //free - reserved = 0
    expect(hexToBn(tokensAfterJoin.free)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.activatedUnstakedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.stakedAndActivatedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.unspentReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.relockAmount)).bnEqual(new BN(0));
  });
  test("join as collator + activate  > acount balances are reserved + mpl checks", async () => {
    await sudo.promotePool(liqTokenForCandidate);

    await activateLiquidity(
      testUser1.keyRingPair,
      liqTokenForCandidate,
      liqTokensAmount,
      "StakedUnactivatedReserves",
    );

    const mplStatus = await getMultiPurposeLiquidityStatus(
      testUser1.keyRingPair.address,
      liqTokenForCandidate,
    );
    const tokensAfterJoin =
      await testUser1.getUserTokensAccountInfo(liqTokenForCandidate);
    expect(hexToBn(mplStatus.stakedAndActivatedReserves)).bnEqual(
      liqTokensAmount,
    );
    expect(hexToBn(tokensAfterJoin.reserved)).bnEqual(liqTokensAmount);

    //free - reserved = 0
    expect(hexToBn(tokensAfterJoin.free)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.activatedUnstakedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.stakedUnactivatedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.unspentReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.relockAmount)).bnEqual(new BN(0));
  });

  afterEach(async () => {
    try {
      await deactivateLiquidity(
        testUser1.keyRingPair,
        liqTokenForCandidate,
        liqTokensAmount,
      );
    } catch (error) {}
  });
});

describe("MPL: Collators - Activated liq", () => {
  beforeAll(async () => {
    keyring = new Keyring({ type: "ethereum" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    const api = await getApi();
    // setup users
    const tokenAmount = new BN(
      await api.consts.parachainStaking.minCandidateStk.toString(),
    ).muln(100);
    testUser1 = new User(keyring);
    sudo = new SudoUser(keyring, node);
    //create two tokens + pool + sudo.activateliqtoken
    const results = await Assets.setupUserWithCurrencies(
      testUser1,
      [tokenAmount],
      sudo,
    );
    await testUser1.addMGATokens(sudo, tokenAmount.muln(1000));
    const tokenId = results[0];
    await testUser1.createPoolToAsset(
      tokenAmount,
      tokenAmount,
      MGA_ASSET_ID,
      tokenId,
    );
    liqTokenForCandidate = await getLiquidityAssetId(MGA_ASSET_ID, tokenId);
    await sudo.promotePool(liqTokenForCandidate);
    await sudo.addStakingLiquidityToken(liqTokenForCandidate);

    liqTokenForCandidate = await getLiquidityAssetId(MGA_ASSET_ID, tokenId);
    liqTokensAmount = hexToBn(
      (await testUser1.getUserTokensAccountInfo(liqTokenForCandidate)).free,
    );
    await activateLiquidity(
      testUser1.keyRingPair,
      liqTokenForCandidate,
      liqTokensAmount,
    );
  });

  test("join as collator with activated liq. > verify account balances are reserved + mpl checks", async () => {
    await testUser1.joinAsCandidate(
      liqTokenForCandidate,
      liqTokensAmount,
      "activatedunstakedreserves",
    );

    const mplStatus = await getMultiPurposeLiquidityStatus(
      testUser1.keyRingPair.address,
      liqTokenForCandidate,
    );
    const tokensAfterJoin =
      await testUser1.getUserTokensAccountInfo(liqTokenForCandidate);
    expect(hexToBn(mplStatus.stakedAndActivatedReserves)).bnEqual(
      liqTokensAmount,
    );
    expect(hexToBn(tokensAfterJoin.reserved)).bnEqual(liqTokensAmount);

    //free - reserved = 0
    expect(hexToBn(tokensAfterJoin.free)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.stakedUnactivatedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.activatedUnstakedReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.unspentReserves)).bnEqual(new BN(0));
    expect(hexToBn(mplStatus.relockAmount)).bnEqual(new BN(0));
  });
});
