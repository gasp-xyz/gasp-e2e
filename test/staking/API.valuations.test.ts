/*
 *
 * @group experimentalStaking
 */
import { jest } from "@jest/globals";
import {
  getLiquidityAssetId,
  joinCandidate,
  mintLiquidity,
} from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { MAX_BALANCE, MGA_ASSET_ID } from "../../utils/Constants";
import { getUserBalanceOfToken } from "../../utils/utils";
import { BN_BILLION, BN_ONE, BN_ZERO } from "gasp-sdk";
import { BN } from "@polkadot/util";
import { Assets } from "../../utils/Assets";
import { getApi, initApi } from "../../utils/api";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { Staking } from "../../utils/Staking";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { ExtrinsicResult } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let keyring: Keyring;
let liqToken: BN;
let newTokenId: BN;
const multiplier = BN_BILLION;
let minLiquidityToJoin: BN;

describe("Collators: MinCandidateStk limit", () => {
  beforeAll(async () => {
    keyring = new Keyring({ type: "ethereum" });
    await initApi();
    const api = await getApi();
    await setupApi();
    await setupUsers();
    const tokenAmount = new BN(
      await api.consts.parachainStaking.minCandidateStk.toString(),
    );
    const aBigEnoughAmount = tokenAmount.mul(multiplier);
    const totalMgxInPool = aBigEnoughAmount.divn(10);
    testUser1 = new User(keyring);
    testUser2 = new User(keyring);
    testUser3 = new User(keyring);
    testUser4 = new User(keyring);
    const sudo = getSudoUser();
    newTokenId = await Assets.issueAssetToUser(
      sudo,
      tokenAmount.mul(multiplier),
      sudo,
      true,
    );
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newTokenId, testUser1, aBigEnoughAmount),
      Assets.mintToken(newTokenId, testUser2, aBigEnoughAmount),
      Assets.mintToken(newTokenId, testUser3, aBigEnoughAmount),
      Assets.mintToken(newTokenId, testUser4, aBigEnoughAmount),
      Assets.mintNative(testUser1, aBigEnoughAmount),
      Assets.mintNative(testUser2, aBigEnoughAmount),
      Assets.mintNative(testUser3, aBigEnoughAmount),
      Assets.mintNative(testUser4, aBigEnoughAmount),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          MGA_ASSET_ID,
          totalMgxInPool,
          newTokenId,
          aBigEnoughAmount.div(multiplier),
        ),
      ),
    );

    liqToken = await getLiquidityAssetId(MGA_ASSET_ID, newTokenId);
    await Sudo.asSudoFinalized(
      Sudo.sudo(Staking.addStakingLiquidityToken(liqToken)),
    );
    minLiquidityToJoin = await calculateMinLiquidity(liqToken, totalMgxInPool);
  });

  test("Min Mangatas to be a collator matches with minLiq.", async () => {
    const api = await getApi();
    const minCandidate = new BN(
      await api.consts.parachainStaking.minCandidateStk.toString(),
    );
    await mintLiquidity(
      testUser2.keyRingPair,
      MGA_ASSET_ID,
      newTokenId,
      minCandidate,
      MAX_BALANCE,
    );
    const liqTokens = await getUserBalanceOfToken(liqToken, testUser2);
    expect(new BN(liqTokens.free)).bnEqual(minLiquidityToJoin);
  });
  test("Min Mangatas -1 will make joinCollator fail", async () => {
    const api = await getApi();
    const minCandidate = new BN(
      await api.consts.parachainStaking.minCandidateStk.toString(),
    ).sub(BN_ONE);
    await mintLiquidity(
      testUser4.keyRingPair,
      MGA_ASSET_ID,
      newTokenId,
      minCandidate,
      MAX_BALANCE,
    );
    const liqTokens = await getUserBalanceOfToken(liqToken, testUser4);
    expect(liqTokens.free).bnGt(BN_ZERO);
    const events = await joinCandidate(
      testUser4.keyRingPair,
      liqToken,
      liqTokens.free,
      "AvailableBalance",
      false,
    );
    expect(events.data).toEqual("CandidateBondBelowMin");
  });
  test("Min Mangatas +1 will make joinCollator work", async () => {
    const api = await getApi();
    const minCandidate = new BN(
      await api.consts.parachainStaking.minCandidateStk.toString(),
    ).add(BN_ONE);
    await mintLiquidity(
      testUser3.keyRingPair,
      MGA_ASSET_ID,
      newTokenId,
      minCandidate,
      MAX_BALANCE,
    );
    const liqTokens = await getUserBalanceOfToken(liqToken, testUser3);
    expect(liqTokens.free).bnGt(BN_ZERO);
    const events = await joinCandidate(
      testUser3.keyRingPair,
      liqToken,
      liqTokens.free,
      "AvailableBalance",
    );
    expect(events.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

async function calculateMinLiquidity(liqTkn: BN, totalMgxInPool: BN) {
  const api = await getApi();
  const totalIssuance = new BN(await api.query.tokens.totalIssuance(liqTkn));
  const minCandidateStk = new BN(
    await api.consts.parachainStaking.minCandidateStk.toString(),
  );
  return minCandidateStk.mul(totalIssuance).div(totalMgxInPool);
}
