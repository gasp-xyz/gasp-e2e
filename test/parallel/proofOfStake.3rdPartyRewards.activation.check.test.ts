/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { BN } from "@polkadot/util";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import { burnLiquidity, getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";

let testUser: User;
let sudo: User;

let newToken1: BN;
let newToken2: BN;
let newToken3: BN;
let liqIdMgaToken1: BN;
let liqIdMgaToken2: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    sudo = getSudoUser();
    [newToken1, newToken2, newToken3] = await Assets.setupUserWithCurrencies(
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
      Assets.mintToken(newToken1, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Sudo.sudoAs(
        sudo,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken1,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
      Sudo.sudoAs(
        sudo,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
    liqIdMgaToken1 = await getLiquidityAssetId(MGA_ASSET_ID, newToken1);
    liqIdMgaToken2 = await getLiquidityAssetId(MGA_ASSET_ID, newToken2);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        sudo,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken1,
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          20,
        ),
      ),
      Assets.promotePool(liqIdMgaToken1.toNumber(), 20),
      Assets.promotePool(liqIdMgaToken2.toNumber(), 20),
    );
  });

  beforeEach(async () => {
    [testUser] = setupUsers();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
    );
  });

  describe("Added scenarios with reward activation", () => {
    test("GIVEN promoted pool AND user with liquidity tokens for this pool WHEN user tries to activate 3rd party rewards for non-promoted liqToken THEN receive error", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(liqIdMgaToken1, testUser, Assets.DEFAULT_AMOUNT),
      );
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqIdMgaToken1,
          Assets.DEFAULT_AMOUNT,
          newToken3,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotAPromotedPool");
      });
    });

    test("GIVEN two promoted pool AND user without liquidity tokens for first promoted WHEN user tries to activate 3rd party rewards for reward token THEN receive error", async () => {
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqIdMgaToken1,
          Assets.DEFAULT_AMOUNT,
          newToken2,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotEnoughAssets");
      });
    });

    test("GIVEN promoted two promoted pool AND user with liquidity tokens for first promoted pool WHEN user tries to activate 3rd party rewards for second (reward) token with too many liquidity tokens THEN receive error", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(liqIdMgaToken1, testUser, Assets.DEFAULT_AMOUNT),
      );
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqIdMgaToken1,
          Assets.DEFAULT_AMOUNT.muln(2),
          newToken2,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotEnoughAssets");
      });
    });

    test("GIVEN promoted two promoted pool AND user with liquidity tokens for first promoted pool WHEN user activates 3rd party rewards for non-reward token THEN he cant claim rewards", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(liqIdMgaToken1, testUser, Assets.DEFAULT_AMOUNT),
      );
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqIdMgaToken1,
          Assets.DEFAULT_AMOUNT,
          newToken3,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotAPromotedPool");
      });
      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqIdMgaToken1, newToken3),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotAPromotedPool");
      });
    });

    test("GIVEN promoted two promoted pool AND user with liquidity tokens for first promoted pool WHEN user activates 3rd party rewards for second (reward) token, waits and claims all rewards THEN operation is successful", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(
          liqIdMgaToken1,
          testUser,
          Assets.DEFAULT_AMOUNT.muln(2),
        ),
      );
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqIdMgaToken1,
          Assets.DEFAULT_AMOUNT,
          newToken2,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      testUser.addAsset(newToken2);
      await testUser.refreshAmounts(AssetWallet.BEFORE);

      await waitForRewards(testUser, liqIdMgaToken1, 40, newToken3);

      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqIdMgaToken1, newToken2),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      await testUser.refreshAmounts(AssetWallet.AFTER);
      const rewardTokenBefore =
        testUser.getAsset(newToken2)?.amountBefore.free!;
      const rewardTokenAfter = testUser.getAsset(newToken2)?.amountAfter.free!;

      expect(rewardTokenBefore).bnEqual(BN_ZERO);
      expect(rewardTokenAfter).bnGt(BN_ZERO);
    });

    test("GIVEN promoted two promoted pool AND user with liquidity tokens for first promoted pool WHEN user activates 3rd party rewards for second (reward) token , waits more than one period last AND the user burns all his liquidity THEN users can still claim pending rewards", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(
          liqIdMgaToken1,
          testUser,
          Assets.DEFAULT_AMOUNT.muln(2),
        ),
      );
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqIdMgaToken1,
          Assets.DEFAULT_AMOUNT,
          newToken2,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      await waitForRewards(testUser, liqIdMgaToken1, 40, newToken2);

      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqIdMgaToken1,
          Assets.DEFAULT_AMOUNT,
          newToken2,
        ),
        testUser.keyRingPair,
      );

      await burnLiquidity(
        testUser.keyRingPair,
        MGA_ASSET_ID,
        newToken1,
        Assets.DEFAULT_AMOUNT.muln(2),
      );

      testUser.addAsset(newToken2);
      await testUser.refreshAmounts(AssetWallet.BEFORE);
      const rewardTokenBefore =
        testUser.getAsset(newToken2)?.amountBefore.free!;

      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqIdMgaToken1, newToken2),
        testUser.keyRingPair,
      );

      await testUser.refreshAmounts(AssetWallet.AFTER);
      const rewardTokenAfter = testUser.getAsset(newToken2)?.amountAfter.free!;

      expect(rewardTokenBefore).bnEqual(BN_ZERO);
      expect(rewardTokenAfter).bnGt(BN_ZERO);
    });
  });
});
