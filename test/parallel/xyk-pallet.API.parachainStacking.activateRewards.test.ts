/*
 *
 * @group rewardsV2Parallel
 *
 */
import { jest } from "@jest/globals";
import {
  getLiquidityAssetId,
  joinCandidate,
  getRewardsInfo,
  activateLiquidity,
} from "../../utils/tx";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { getUserBalanceOfToken } from "../../utils/utils";
import { BN_BILLION, BN_ONE, BN_ZERO } from "@mangata-finance/sdk";
import { Assets } from "../../utils/Assets";
import { getApi, initApi } from "../../utils/api";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { Staking } from "../../utils/Staking";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let keyring: Keyring;
let liqToken: BN;
let newTokenId: BN;

const multiplier = BN_BILLION;

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
    Assets.mintNative(testUser1, aBigEnoughAmount),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(GASP_ASSET_ID, totalMgxInPool, newTokenId, tokenAmount),
    ),
  );
  liqToken = await getLiquidityAssetId(GASP_ASSET_ID, newTokenId);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken)),
    Assets.promotePool(liqToken.toNumber(), 20),
  );
});

test("Given a user with bonded but not activated liq tokens WHEN he tries to activate THEN the tokens are activated for rewards", async () => {
  const api = await getApi();

  const minCandidate = new BN(
    await api.consts.parachainStaking.minCandidateStk.toString(),
  ).add(BN_ONE);
  const liqTokens = await getUserBalanceOfToken(liqToken, testUser1);
  expect(liqTokens.free).bnGt(BN_ZERO);
  const events = await joinCandidate(
    testUser1.keyRingPair,
    liqToken,
    minCandidate,
    "AvailableBalance",
  );
  expect(events.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const rewardsInfoBefore = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqToken,
  );

  await activateLiquidity(
    testUser1.keyRingPair,
    liqToken,
    minCandidate,
    "StakedUnactivatedReserves",
  );

  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqToken,
  );
  expect(rewardsInfoBefore.activatedAmount).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.activatedAmount).bnGt(BN_ZERO);
});
