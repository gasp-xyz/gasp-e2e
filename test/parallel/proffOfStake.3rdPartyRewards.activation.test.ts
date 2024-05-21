/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { BN } from "@polkadot/util";
import { waitIfSessionWillChangeInNblocks } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { api, getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { PalletProofOfStakeThirdPartyActivationKind } from "@polkadot/types/lookup";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let sudo: User;

let newToken: BN;
let newToken2: BN;
let newToken3: BN;
let newToken4: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    sudo = getSudoUser();
    [testUser1, testUser2, testUser3] = setupUsers();
    [newToken, newToken2, newToken3, newToken4] =
      await Assets.setupUserWithCurrencies(
        sudo,
        [
          Assets.DEFAULT_AMOUNT,
          Assets.DEFAULT_AMOUNT,
          Assets.DEFAULT_AMOUNT,
          Assets.DEFAULT_AMOUNT,
        ],
        sudo,
        true,
      );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(
        newToken,
        testUser1,
        Assets.DEFAULT_AMOUNT.muln(40e6).muln(2),
      ),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser2, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken4, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken4, testUser3, Assets.DEFAULT_AMOUNT.muln(40e6)),
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
        testUser3,
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
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken4,
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
          3,
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken2,
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          newToken3,
          Assets.DEFAULT_AMOUNT,
          Assets.DEFAULT_AMOUNT.muln(2),
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken3,
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken3,
          newToken4,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
    );
  });

  describe("Activation rewards scenarios", () => {
    test("A user can activate some rewards", async () => {
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

      const totalActivated =
        await ProofOfStake.totalActivatedLiquidityForSchedules(liqId, newToken);
      expect(totalActivated.pendingPositive).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(totalActivated.pendingNegative).bnEqual(BN_ZERO);

      const rewardsInfo = await ProofOfStake.rewardsInfoForScheduleRewards(
        testUser.keyRingPair.address,
        liqId,
        newToken,
      );
      expect(rewardsInfo.activatedAmount).bnEqual(Assets.DEFAULT_AMOUNT);
    });
    test("A user can activate twice some rewards", async () => {
      const testUser = testUser2;
      const liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken2);
      testUser.addAssets([liqId, newToken2]);
      await testUser.refreshAmounts();
      await signTx(
        getApi(),
        api.tx.utility.batchAll([
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liqId,
            Assets.DEFAULT_AMOUNT.divn(2),
            newToken2,
          ),
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liqId,
            Assets.DEFAULT_AMOUNT.divn(2),
            newToken2,
          ),
        ]),
        testUser.keyRingPair,
      );
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === liqId)?.diff.free,
      ).bnEqual(Assets.DEFAULT_AMOUNT.neg());
      const withoutMgx = diff.filter(
        (assetDiff) =>
          assetDiff.currencyId.toNumber() !== MGA_ASSET_ID.toNumber(),
      );
      expect(withoutMgx).toHaveLength(1);

      const activatedAmount = await ProofOfStake.activatedLiquidityForSchedules(
        liqId,
        testUser.keyRingPair.address,
        newToken2,
      );
      expect(activatedAmount).bnEqual(Assets.DEFAULT_AMOUNT);

      const totalActivated =
        await ProofOfStake.totalActivatedLiquidityForSchedules(
          liqId,
          newToken2,
        );
      expect(totalActivated.pendingPositive).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(totalActivated.total).bnEqual(BN_ZERO);
      expect(totalActivated.pendingNegative).bnEqual(BN_ZERO);

      const rewardsInfo = await ProofOfStake.rewardsInfoForScheduleRewards(
        testUser.keyRingPair.address,
        liqId,
        newToken2,
      );
      expect(rewardsInfo.activatedAmount).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(rewardsInfo.missingAtLastCheckpoint).bnEqual(
        Assets.DEFAULT_AMOUNT.divn(2),
      );
    });
    test("A user can activate rewards that were activated on some other schedules", async () => {
      const testUser = testUser3;
      //user3 has mgx anf new token. He can provide liq on mgx/new token and mgx/new token2 rewards
      const liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken3);
      testUser.addAssets([liqId, newToken3, newToken4, MGA_ASSET_ID]);
      await testUser.refreshAmounts();
      await waitIfSessionWillChangeInNblocks(6);
      const totalActivatedBefore =
        await ProofOfStake.totalActivatedLiquidityForSchedules(
          liqId,
          newToken3,
        );
      await signTx(
        getApi(),
        api.tx.utility.batchAll([
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liqId,
            Assets.DEFAULT_AMOUNT,
            newToken3,
          ),
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liqId,
            Assets.DEFAULT_AMOUNT,
            newToken4,
            {
              ActivatedLiquidity: newToken3,
            } as unknown as PalletProofOfStakeThirdPartyActivationKind,
          ),
        ]),
        testUser.keyRingPair,
      );
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === liqId)?.diff.free,
      ).bnEqual(Assets.DEFAULT_AMOUNT.neg());
      const withoutMgx = diff.filter(
        (assetDiff) =>
          assetDiff.currencyId.toNumber() !== MGA_ASSET_ID.toNumber(),
      );
      expect(withoutMgx).toHaveLength(1);

      const activatedAmount = await ProofOfStake.activatedLiquidityForSchedules(
        liqId,
        testUser.keyRingPair.address,
        newToken3,
      );
      const activatedAmount2 =
        await ProofOfStake.activatedLiquidityForSchedules(
          liqId,
          testUser.keyRingPair.address,
          newToken4,
        );

      expect(activatedAmount).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(activatedAmount2).bnEqual(Assets.DEFAULT_AMOUNT);

      const totalActivated =
        await ProofOfStake.totalActivatedLiquidityForSchedules(
          liqId,
          newToken3,
        );
      expect(totalActivated.pendingPositive).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(totalActivated.total).bnEqual(
        totalActivatedBefore.pendingPositive,
      );
      expect(totalActivated.pendingNegative).bnEqual(BN_ZERO);

      const totalActivated2 =
        await ProofOfStake.totalActivatedLiquidityForSchedules(
          liqId,
          newToken4,
        );

      expect(totalActivated2.pendingPositive).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(totalActivated2.total).bnEqual(BN_ZERO);
      expect(totalActivated2.pendingNegative).bnEqual(BN_ZERO);

      const rewardsInfo = await ProofOfStake.rewardsInfoForScheduleRewards(
        testUser.keyRingPair.address,
        liqId,
        newToken3,
      );
      expect(rewardsInfo.activatedAmount).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(rewardsInfo.missingAtLastCheckpoint).bnEqual(
        Assets.DEFAULT_AMOUNT,
      );
      const rewardsInfo2 = await ProofOfStake.rewardsInfoForScheduleRewards(
        testUser.keyRingPair.address,
        liqId,
        newToken4,
      );
      expect(rewardsInfo2.activatedAmount).bnEqual(Assets.DEFAULT_AMOUNT);
      expect(rewardsInfo2.missingAtLastCheckpoint).bnEqual(
        Assets.DEFAULT_AMOUNT,
      );
    });
  });
});
