/*
 *
 * @group 3rdPartyRewards
 */
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { BN } from "@polkadot/util";
import {
  getThirdPartyRewards,
  getUserBalanceOfToken,
  stringToBN,
} from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION, BN_ZERO, signTx } from "gasp-sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { getLiquidityAssetId } from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { testLog } from "../../utils/Logger";
import { Market } from "../../utils/market";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let sudo: User;

let newToken: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    sudo = getSudoUser();
    [testUser1, testUser2, testUser3] = setupUsers();
    newToken = await Assets.issueAssetToUser(
      sudo,
      Assets.DEFAULT_AMOUNT,
      sudo,
      true,
    );

    await setupApi();
    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2),
      Assets.mintNative(testUser3),
      Sudo.sudoAs(
        testUser1,
        Market.createPool(
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
    const liqId = await getLiquidityAssetId(GASP_ASSET_ID, newToken);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser2,
        Market.mintLiquidity(
          liqId,
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        Market.mintLiquidity(
          liqId,
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.rewardPool(
          GASP_ASSET_ID,
          newToken,
          newToken,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.rewardPool(
          GASP_ASSET_ID,
          newToken,
          newToken,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          Assets.DEFAULT_AMOUNT.divn(10),
          newToken,
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        await ProofOfStake.rewardPool(
          GASP_ASSET_ID,
          newToken,
          newToken,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
    );
  });

  describe("Happy path", () => {
    test("A user can deactivate all the tokens when partial activation / deactivation", async () => {
      const liqId = await getLiquidityAssetId(GASP_ASSET_ID, newToken);
      testLog.getLog().warn("liqId: " + liqId.toString());
      await waitForRewards(testUser1, liqId, 40, newToken);
      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          BN_MILLION,
          newToken,
        ),
        testUser1.keyRingPair,
      ).then((events) => {
        expect(getEventResultFromMangataTx(events).state).toBe(
          ExtrinsicResult.ExtrinsicSuccess,
        );
      });
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          BN_MILLION,
          newToken,
        ),
        testUser1.keyRingPair,
      ).then((events) => {
        expect(getEventResultFromMangataTx(events).state).toBe(
          ExtrinsicResult.ExtrinsicSuccess,
        );
      });
      const amountToDeactivate =
        await ProofOfStake.activatedLiquidityForSchedules(
          liqId,
          testUser1.keyRingPair.address,
          newToken,
        );
      await waitForRewards(testUser1, liqId, 40, newToken);
      await waitForRewards(testUser1, liqId, 40, newToken);

      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          amountToDeactivate,
          newToken,
        ),
        testUser1.keyRingPair,
      ).then((events) => {
        expect(getEventResultFromMangataTx(events).state).toBe(
          ExtrinsicResult.ExtrinsicSuccess,
        );
      });
      const userBalance = await getUserBalanceOfToken(liqId, testUser1);
      expect(userBalance.reserved).bnEqual(BN_ZERO);
      expect(userBalance.frozen).bnEqual(BN_ZERO);
      const userBalanceBefore = await getUserBalanceOfToken(
        newToken,
        testUser1,
      );
      const rewards = await getThirdPartyRewards(
        testUser1.keyRingPair.address,
        liqId,
        newToken,
      );
      testUser1.addAsset(GASP_ASSET_ID);
      await testUser1.refreshAmounts();
      await signTx(
        getApi(),
        await ProofOfStake.claim3rdpartyRewards(liqId, newToken),
        testUser1.keyRingPair,
      ).then((events) => {
        expect(getEventResultFromMangataTx(events).state).toBe(
          ExtrinsicResult.ExtrinsicSuccess,
        );
        const claimEvent = getEventResultFromMangataTx(events, [
          "ThirdPartyRewardsClaimed",
        ]);
        expect(claimEvent.data[0]).toEqual(testUser1.keyRingPair.address);
        expect(stringToBN(claimEvent.data[1].toString())).bnEqual(liqId);
        expect(stringToBN(claimEvent.data[2].toString())).bnEqual(newToken);
        expect(claimEvent.data[3].replaceAll(",", "")).toEqual(
          rewards.toString(),
        );
      });
      await testUser1.refreshAmounts(AssetWallet.AFTER);
      const diff = testUser1.getWalletDifferences();
      expect(
        diff.find((assetDiff) => assetDiff.currencyId === GASP_ASSET_ID),
      ).toBeUndefined();
      const userBalanceAfter = await getUserBalanceOfToken(newToken, testUser1);
      expect(userBalanceAfter.free.sub(userBalanceBefore.free)).bnEqual(
        rewards,
      );
    });
  });
});
