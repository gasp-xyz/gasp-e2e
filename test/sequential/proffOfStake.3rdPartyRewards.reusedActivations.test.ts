/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import {
  getEnvironmentRequiredVars,
  getThirdPartyRewards,
  waitIfSessionWillChangeInNblocks,
} from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import {
  waitForRewards,
  waitforSessionChange,
} from "../../utils/eventListeners";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let sudo: User;

let keyring: Keyring;
let newToken: BN;
let newToken2: BN;
let newToken3: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
    [testUser1, testUser2, testUser3] = setupUsers();
    [newToken, newToken2, newToken3] = await Assets.setupUserWithCurrencies(
      sudo,
      [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
      sudo,
      true,
    );

    await setupApi();
    await waitIfSessionWillChangeInNblocks(5);
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser3, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser2,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser2,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        Xyk.createPool(
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken,
          newToken,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          1,
        ),
      ),
    );
  });

  describe("Activations are reused if new rewards", () => {
    test("A user can activate - finish schedule and get automatically activated for the following schedules", async () => {
      // There are two rewards for newToken. One is for newToken and one is for newToken3
      const testUser = testUser1;
      const liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
      testUser.addAssets([liqId, newToken, MGA_ASSET_ID]);
      await testUser.refreshAmounts();
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser1.keyRingPair,
      );
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === liqId)?.diff.free,
      ).bnEqual(Assets.DEFAULT_AMOUNT.neg());
      expect(diff).toHaveLength(1);

      const activatedAmount = await ProofOfStake.activatedLiquidityForSchedules(
        liqId,
        testUser.keyRingPair.address,
        newToken,
      );
      expect(activatedAmount).bnEqual(Assets.DEFAULT_AMOUNT);
      await waitForRewards(testUser, liqId, 20, newToken);
      // now we have rewards available for newToken
      const availableRewards = await getThirdPartyRewards(
        testUser.keyRingPair.address,
        liqId,
        newToken,
      );
      expect(availableRewards).bnEqual(Assets.DEFAULT_AMOUNT.muln(10e6));
      await waitforSessionChange();

      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            newToken3,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            1,
          ),
        ),
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken,
            newToken,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            1,
          ),
        ),
        Sudo.sudoAs(
          testUser2,
          Xyk.mintLiquidity(
            MGA_ASSET_ID,
            newToken,
            Assets.DEFAULT_AMOUNT.muln(3),
            Assets.DEFAULT_AMOUNT.muln(4),
          ),
        ),
        Sudo.sudoAs(
          testUser2,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liqId,
            Assets.DEFAULT_AMOUNT,
            newToken,
          ),
        ),
        Sudo.sudoAs(
          testUser2,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liqId,
            Assets.DEFAULT_AMOUNT,
            newToken3,
          ),
        ),
      );
      // testUser must have the liq already activated for mgx-new token - newtoken
      // testUser2 just activated for both rewarded mgx-newtoken pools
      await waitForRewards(testUser2, liqId, 20, newToken);
      // So expected is: for first rewards shares are divided, for the second, only testUser2 gets rewards
      const expectedSharedReward = Assets.DEFAULT_AMOUNT.muln(10e6).divn(2);
      const expectedOnlyTestUser2Reward = Assets.DEFAULT_AMOUNT.muln(10e6);
      const testUserRewards = (
        await getThirdPartyRewards(
          testUser.keyRingPair.address,
          liqId,
          newToken,
        )
      ).sub(availableRewards);
      const testUser2Rewards = await getThirdPartyRewards(
        testUser2.keyRingPair.address,
        liqId,
        newToken,
      );
      expect(testUserRewards).bnEqual(
        expectedSharedReward,
      );
      expect(testUser2Rewards).bnEqual(testUserRewards);

      const testUserRewardsT3 = await getThirdPartyRewards(
        testUser.keyRingPair.address,
        liqId,
        newToken3,
      );
      const testUser2RewardsT3 = await getThirdPartyRewards(
        testUser2.keyRingPair.address,
        liqId,
        newToken3,
      );
      expect(testUser2RewardsT3).bnEqual(expectedOnlyTestUser2Reward);
      expect(testUserRewardsT3).bnEqual(BN_ZERO);
    });
  });
});
