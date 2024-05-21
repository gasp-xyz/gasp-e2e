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
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";

let testUser: User;
let sudo: User;

let newToken1: BN;
let newToken2: BN;
let newToken3: BN;
let liqIdMgaToken1: BN;
let liqIdMgaToken2: BN;
let liqIdMgaToken3: BN;

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
      [Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT],
      sudo,
      true,
    );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken1, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken2, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken3, sudo, Assets.DEFAULT_AMOUNT.muln(40e6)),
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
    liqIdMgaToken1 = await getLiquidityAssetId(MGA_ASSET_ID, newToken1);
    liqIdMgaToken2 = await getLiquidityAssetId(MGA_ASSET_ID, newToken2);
    liqIdMgaToken3 = await getLiquidityAssetId(MGA_ASSET_ID, newToken3);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        sudo,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken1,
          newToken2,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
      Sudo.sudoAs(
        sudo,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken1,
          newToken3,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
      Assets.promotePool(liqIdMgaToken1.toNumber(), 20),
      Assets.promotePool(liqIdMgaToken2.toNumber(), 20),
      Assets.promotePool(liqIdMgaToken3.toNumber(), 20),
    );
  });

  beforeEach(async () => {
    [testUser] = setupUsers();
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(liqIdMgaToken1, testUser, Assets.DEFAULT_AMOUNT.muln(2)),
      Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(2)),
    );
  });

  describe("Scenarios with reward activation for  promoted pool MGX-Token1, reward pool MGX-Token2", () => {
    test("GIVEN promoted pool MGX-Token1,  pool MGX-Token2,  pool MGX-Token3 AND user with activated 3rd party rewards of pool MGX-Token1 for Token2 and Token3 WHEN user claim all rewards  THEN he receive 2 type of rewards", async () => {
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
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      await waitForRewards(testUser, liqIdMgaToken1, 40, newToken2);
      await waitForRewards(testUser, liqIdMgaToken1, 40, newToken3);

      testUser.addAsset(newToken2);
      testUser.addAsset(newToken3);
      await testUser.refreshAmounts(AssetWallet.BEFORE);
      const rewardToken1Before =
        testUser.getAsset(newToken2)?.amountBefore.free!;
      const rewardToken3Before =
        testUser.getAsset(newToken3)?.amountBefore.free!;

      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqIdMgaToken1, newToken2),
        testUser.keyRingPair,
      );

      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqIdMgaToken1, newToken3),
        testUser.keyRingPair,
      );

      await testUser.refreshAmounts(AssetWallet.AFTER);
      const rewardToken1After = testUser.getAsset(newToken2)?.amountAfter.free!;
      const rewardToken3After = testUser.getAsset(newToken3)?.amountAfter.free!;

      expect(rewardToken1Before).bnEqual(BN_ZERO);
      expect(rewardToken3Before).bnEqual(BN_ZERO);
      expect(rewardToken1After).bnGt(BN_ZERO);
      expect(rewardToken3After).bnGt(BN_ZERO);
    });

    test("GIVEN promoted pool MGX-Token1, pool MGX-Token2 AND user with activated 3rd party rewards of pool MGX-Token1 for Token2 WHEN user deactivates 3rd party rewadrs with too many liquidity tokens THEN receive error", async () => {
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
  });
});
