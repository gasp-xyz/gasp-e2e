/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { ProofOfStake } from "../../utils/ProofOfStake";
import "jest-extended";
import { burnLiquidity, getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";

let testUser: User;
let sudo: User;

let keyring: Keyring;
let newToken: BN;
let newToken2: BN;
let newToken3: BN;
let liqId: BN;
let liqId2: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  });

  beforeEach(async () => {
    [testUser] = setupUsers();
    [newToken, newToken2, newToken3] = await Assets.setupUserWithCurrencies(
      sudo,
      [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
      sudo,
      true,
    );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken2, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(2)),
      Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
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
    liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken2);
  });

  describe("Activation rewards scenarios", () => {
    test("GIVEN promoted pool MGX-Token2 AND user with liquidity tokens for MGX-Token2 WHEN user tries to activate 3rd party rewards for Token1 THEN receive error", async () => {
      await Sudo.batchAsSudoFinalized(
        Assets.promotePool(liqId.toNumber(), 20),
        Assets.mintToken(liqId, testUser, Assets.DEFAULT_AMOUNT),
      );

      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotAPromotedPool");
      });
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user without liquidity tokens for MGX-Token2 WHEN  user tries to activate 3rd party rewards for Token1 THEN receive error", async () => {
      await createAndPromoteSecondPool(BN_ZERO, true);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotEnoughAssets");
      });
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user with liquidity tokens for MGX-Token2 WHEN user tries to activate 3rd party rewards for Token1 with too many liquidity tokens THEN receive error", async () => {
      await createAndPromoteSecondPool(Assets.DEFAULT_AMOUNT, true);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT.muln(2),
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotEnoughAssets");
      });
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user with liquidity tokens for MGX-Token2 WHEN user activates 3rd party rewards for Token1 AND does not uses rewardPool function THEN he cant claim rewards", async () => {
      await createAndPromoteSecondPool(Assets.DEFAULT_AMOUNT.muln(2), false);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotAPromotedPool");
      });
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user with liquidity tokens for MGX-Token2 WHEN user activates 3rd party rewards for Token1, waits and claims all rewards THEN operation is successful", async () => {
      await createAndPromoteSecondPool(Assets.DEFAULT_AMOUNT.muln(2), true);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user with liquidity tokens for MGX-Token2 WHEN user activates 3rd party rewards for Token1, waits more than one period last AND the user burns all his liquidity THEN users can still claim pending rewards", async () => {
      await createAndPromoteSecondPool(Assets.DEFAULT_AMOUNT.muln(2), true);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      await waitForRewards(testUser, liqId, 20, newToken);

      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      );

      await burnLiquidity(
        testUser.keyRingPair,
        MGA_ASSET_ID,
        newToken2,
        Assets.DEFAULT_AMOUNT.muln(2),
      );

      testUser.addAsset(newToken);
      await testUser.refreshAmounts(AssetWallet.BEFORE);
      const rewardTokenBefore =
        await testUser.getAsset(newToken)?.amountBefore.free!;

      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqId, newToken),
        testUser.keyRingPair,
      );

      await testUser.refreshAmounts(AssetWallet.AFTER);
      const rewardTokenAfter =
        await testUser.getAsset(newToken)?.amountAfter.free!;

      expect(rewardTokenBefore).bnEqual(BN_ZERO);
      expect(rewardTokenAfter).bnGt(BN_ZERO);
    });

    test("GIVEN promoted pool MGX-Token2,  pool MGX-Token1,  pool MGX-Token3 AND user with activated 3rd party rewards of pool MGX-Token2 for Token1 and Token3 WHEN user claim all rewards  THEN he receive 2 type of rewards", async () => {
      await createAndPromoteSecondPool(Assets.DEFAULT_AMOUNT.muln(2), true);
      await Sudo.batchAsSudoFinalized(
        Assets.mintToken(newToken3, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
        Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
        Sudo.sudoAs(
          sudo,
          Xyk.createPool(
            MGA_ASSET_ID,
            Assets.DEFAULT_AMOUNT.muln(20e6),
            newToken3,
            Assets.DEFAULT_AMOUNT.muln(20e6),
          ),
        ),
      );

      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      await waitForRewards(testUser, liqId, 20, newToken);

      const liqId3 = await getLiquidityAssetId(MGA_ASSET_ID, newToken3);
      await Sudo.batchAsSudoFinalized(
        Sudo.sudoAs(
          sudo,
          await ProofOfStake.rewardPool(
            MGA_ASSET_ID,
            newToken2,
            newToken3,
            Assets.DEFAULT_AMOUNT.muln(10e6),
            2,
          ),
        ),
        Assets.promotePool(liqId3.toNumber(), 20),
      );

      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken3,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      await waitForRewards(testUser, liqId, 20, newToken3);

      testUser.addAsset(newToken);
      testUser.addAsset(newToken3);
      await testUser.refreshAmounts(AssetWallet.BEFORE);
      const rewardToken1Before =
        await testUser.getAsset(newToken)?.amountBefore.free!;
      const rewardToken3Before =
        await testUser.getAsset(newToken3)?.amountBefore.free!;

      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqId, newToken),
        testUser.keyRingPair,
      );

      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqId, newToken3),
        testUser.keyRingPair,
      );

      await testUser.refreshAmounts(AssetWallet.AFTER);
      const rewardToken1After =
        await testUser.getAsset(newToken)?.amountAfter.free!;
      const rewardToken3After =
        await testUser.getAsset(newToken3)?.amountAfter.free!;

      expect(rewardToken1Before).bnEqual(BN_ZERO);
      expect(rewardToken3Before).bnEqual(BN_ZERO);
      expect(rewardToken1After).bnGt(BN_ZERO);
      expect(rewardToken3After).bnGt(BN_ZERO);
    });

    test("GIVEN promoted pool MGX-Token2, pool MGX-Token1 AND user with activated 3rd party rewards of pool MGX-Token2 for Token1 WHEN user deactivates 3rd party rewadrs with too many liquidity tokens THEN receive error", async () => {
      await createAndPromoteSecondPool(Assets.DEFAULT_AMOUNT.muln(2), true);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      await waitForRewards(testUser, liqId, 20, newToken);

      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT.muln(2),
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(res.data).toEqual("NotEnoughAssets");
      });
    });
  });
});

async function createAndPromoteSecondPool(
  userLiqTokenAmount: BN,
  isRewardPoolEnabled: boolean,
) {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(newToken, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
    Assets.mintToken(liqId, testUser, userLiqTokenAmount),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.muln(20e6),
        newToken,
        Assets.DEFAULT_AMOUNT.muln(20e6),
      ),
    ),
    Assets.promotePool(liqId.toNumber(), 20),
  );
  liqId2 = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
  if (isRewardPoolEnabled) {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        sudo,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken2,
          newToken,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          2,
        ),
      ),
      Assets.promotePool(liqId2.toNumber(), 20),
    );
  } else {
    await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId2.toNumber(), 20));
  }
}
