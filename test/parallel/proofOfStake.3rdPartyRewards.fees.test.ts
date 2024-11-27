/*
 *
 * @group 3rdPartyRewards
 *
 */
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { BN } from "@polkadot/util";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO, signTx } from "gasp-sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { getLiquidityAssetId } from "../../utils/tx";
import { testLog } from "../../utils/Logger";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Market } from "../../utils/market";

let testUser0: User;
let testUser1: User;
let sudo: User;

let newToken1: BN;
let newToken2: BN;
let liqId: BN;
let liqId2: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    sudo = getSudoUser();
    [testUser0, testUser1] = setupUsers();

    const setup = await Assets.getSetupUserWithCurrenciesTxs(
      testUser0,
      [BN_ZERO, BN_ZERO],
      sudo,
    );
    [newToken1, newToken2] = setup.tokens;

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(newToken1, testUser0, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken1, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser0, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(testUser0, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Sudo.sudoAs(
        testUser1,
        Market.createPool(
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken1,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        Market.createPool(
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
    liqId = await getLiquidityAssetId(GASP_ASSET_ID, newToken1);
    liqId2 = await getLiquidityAssetId(GASP_ASSET_ID, newToken2);
    testLog.getLog().info("liqId: " + liqId.toString());
    testLog.getLog().info("liqId2: " + liqId2.toString());
  });

  describe("FeeCosts", () => {
    beforeAll(async () => {
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser0,
          await ProofOfStake.rewardPool(
            GASP_ASSET_ID,
            newToken1,
            newToken1,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            3,
          ),
        ),
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
    });
    test("Reward a pool is not free of cost", async () => {
      const testUser = testUser1;
      const amountToReward = Assets.DEFAULT_AMOUNT.muln(10e6);
      testUser.addAssets([GASP_ASSET_ID, newToken1, newToken2]);
      await testUser.refreshAmounts();

      await signTx(
        getApi(),
        await ProofOfStake.rewardPool(
          GASP_ASSET_ID,
          newToken2,
          newToken2,
          amountToReward,
          3,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === GASP_ASSET_ID)?.diff
          .free,
      ).bnLt(BN_ZERO);

      // rewarded token + mgx fees tokens must be affected
      expect(diff).toHaveLength(2);
    });
    test("Activate - deactivate is free if success", async () => {
      const testUser = testUser0;
      const amountToActivate = Assets.DEFAULT_AMOUNT;
      testUser.addAssets([GASP_ASSET_ID, newToken1, newToken2, liqId, liqId2]);
      await signTx(
        getApi(),
        Market.mintLiquidity(
          liqId,
          GASP_ASSET_ID,
          amountToActivate,
          amountToActivate.muln(2),
        ),
        testUser.keyRingPair,
      );
      await testUser.refreshAmounts();

      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          amountToActivate,
          newToken1,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === GASP_ASSET_ID)?.diff
          .free,
      ).toBeUndefined();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === liqId)?.diff.free,
      ).bnEqual(amountToActivate.neg());
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === liqId)?.diff.reserved,
      ).bnEqual(amountToActivate);

      // only rewarded token must be affected
      expect(diff).toHaveLength(1);

      await testUser.refreshAmounts(AssetWallet.BEFORE);
      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          amountToActivate,
          newToken1,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diffDeact = testUser.getWalletDifferences();
      expect(
        diffDeact.find((assetDiff) => assetDiff.currencyId === GASP_ASSET_ID)
          ?.diff.free,
      ).toBeUndefined();
      expect(
        diffDeact.find((assetDiff) => assetDiff.currencyId === liqId)?.diff
          .free,
      ).bnEqual(amountToActivate);
      expect(
        diffDeact.find((assetDiff) => assetDiff.currencyId === liqId)?.diff
          .reserved,
      ).bnEqual(amountToActivate.neg());

      // only rewarded token must be affected
      expect(diffDeact).toHaveLength(1);
    });
    test("Activate - deactivate is not free if fails", async () => {
      const testUser = testUser0;
      const amountToActivate = Assets.DEFAULT_AMOUNT;
      testUser.addAssets([GASP_ASSET_ID, newToken1, newToken2, liqId, liqId2]);
      await testUser.refreshAmounts();

      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId.addn(123),
          amountToActivate,
          newToken1,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      });
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === GASP_ASSET_ID)?.diff
          .free,
      ).bnLt(BN_ZERO);

      // only MGX token must be affected
      expect(diff).toHaveLength(1);

      await testUser.refreshAmounts(AssetWallet.BEFORE);
      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          amountToActivate,
          newToken2, // wrong token
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      });
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diffDeact = testUser.getWalletDifferences();
      expect(
        diffDeact.find((assetDiff) => assetDiff.currencyId === GASP_ASSET_ID)
          ?.diff.free,
      ).bnLt(BN_ZERO);
      // only MGX token must be affected
      expect(diffDeact).toHaveLength(1);
    });
    test("Claiming is not free if Zero", async () => {
      const testUser = testUser0;
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          testUser,
          Market.mintLiquidity(
            liqId,
            GASP_ASSET_ID,
            Assets.DEFAULT_AMOUNT,
            Assets.DEFAULT_AMOUNT.muln(2),
          ),
        ),
        Sudo.sudoAs(
          testUser,
          await ProofOfStake.activateLiquidityFor3rdpartyRewards(
            liqId,
            Assets.DEFAULT_AMOUNT,
            newToken1,
          ),
        ),
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      await testUser.refreshAmounts();
      testUser.addAssets([GASP_ASSET_ID, newToken1, newToken2, liqId, liqId2]);
      await testUser.refreshAmounts();
      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqId, newToken1),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      });
      await testUser.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === GASP_ASSET_ID)?.diff
          .free,
      ).bnLt(BN_ZERO);

      // only MGX token must be affected
      expect(diff).toHaveLength(1);

      await testUser.refreshAmounts(AssetWallet.BEFORE);
    });
  });
});
