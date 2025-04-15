/*
 *
 * @group rewardsV2Sequential
 * @group story
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import {
  claimRewards,
  compoundRewards,
  getLiquidityAssetId,
} from "../../utils/tx";
import { waitForRewards } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { ApiPromise } from "@polkadot/api";
import { User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import {
  calculateMGAFees,
  getEnvironmentRequiredVars,
  rpcCalculateNativeRewards,
} from "../../utils/utils";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { setupUsers, setupApi, getSudoUser } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const defaultCurrecyValue = new BN(250000);

describe("Story tests > Rewards - autocompound", () => {
  let liqId: BN;
  let api: ApiPromise;
  let users: User[] = [];
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    api = getApi();
    await setupApi();
    ({ users, liqId } = await setupPoolWithRewardsForUsers(users));
  });

  test("Given a user1 with minted tokens when two sessions happen, then there are available rewards", async () => {
    const result = await rpcCalculateNativeRewards(
      users[0].keyRingPair.address,
      liqId,
    );
    expect(result).bnGt(new BN(0));
  });
  test("Given a user2 WHEN available rewards can claim and mgas are increased", async () => {
    const testUser2 = users[1];
    const { chainUri } = getEnvironmentRequiredVars();
    const mangata = await getMangataInstance(chainUri);
    const availableRewards = await rpcCalculateNativeRewards(
      testUser2.keyRingPair.address,
      liqId,
    );
    const mgasBalancesBefore = await mangata.query.getTokenBalance(
      GASP_ASSET_ID.toString(),
      testUser2.keyRingPair.address,
    );
    const amount = await calculateMGAFees(
      api.tx.proofOfStake.claimRewardsAll(liqId),
      testUser2.keyRingPair,
    );

    await claimRewards(testUser2, liqId);

    const availableRewardsAfter = await rpcCalculateNativeRewards(
      testUser2.keyRingPair.address,
      liqId,
    );
    const mgasBalancesAfter = await mangata.query.getTokenBalance(
      GASP_ASSET_ID.toString(),
      testUser2.keyRingPair.address,
    );
    const expectedMGAAmount = mgasBalancesBefore.free
      .add(availableRewards)
      .sub(amount);

    expect(expectedMGAAmount).bnLte(mgasBalancesAfter.free);
    expect(availableRewardsAfter).bnEqual(new BN(0));
  });
  test.skip("Given a user3 WHEN available rewards can autocompund", async () => {
    const testUser3 = users[2];
    const { chainUri } = getEnvironmentRequiredVars();
    const mangata = await getMangataInstance(chainUri);
    const liqBefore = await mangata.query.getTokenBalance(
      liqId.toString(),
      testUser3.keyRingPair.address,
    );
    await compoundRewards(testUser3, liqId);
    const availableRewardsAfter = await rpcCalculateNativeRewards(
      testUser3.keyRingPair.address,
      liqId,
    );
    const liqAfter = await mangata.query.getTokenBalance(
      liqId.toString(),
      testUser3.keyRingPair.address,
    );
    expect(liqBefore.reserved).bnLt(liqAfter.reserved);
    expect(availableRewardsAfter).bnLte(new BN(0));
  });
});

async function setupPoolWithRewardsForUsers(users: User[]) {
  const [testUser1, testUser2, testUser3, testUser4] = await setupUsers();
  users = [testUser1, testUser2, testUser3, testUser4];
  const sudo = getSudoUser();
  const token2 = await Assets.issueAssetToUser(
    sudo,
    defaultCurrecyValue,
    sudo,
    true,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser3, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser4, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );
  const liqId = await getLiquidityAssetId(GASP_ASSET_ID, token2);
  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Market.mintLiquidity(liqId, GASP_ASSET_ID, new BN("1000000000000000")),
    ),
    Sudo.sudoAs(
      testUser2,
      Market.mintLiquidity(liqId, GASP_ASSET_ID, new BN("1000000000000000")),
    ),
    Sudo.sudoAs(
      testUser3,
      Market.mintLiquidity(liqId, GASP_ASSET_ID, new BN("1000000000000000")),
    ),
    Sudo.sudoAs(
      testUser4,
      Market.mintLiquidity(liqId, GASP_ASSET_ID, new BN("1000000000000000")),
    ),
  );
  await waitForRewards(testUser4, liqId);
  return { users, liqId, sudo, token2 };
}
