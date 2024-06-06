/*
 *
 * @group 3rdPartyRewards
 *
 */
import { getApi, initApi } from "../../utils/api";
import { PalletProofOfStakeThirdPartyActivationKind } from "@polkadot/types/lookup";
import { User } from "../../utils/User";
import { BN } from "@polkadot/util";
import { getMultiPurposeLiquidityStatus } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  BN_HUNDRED,
  BN_ONE,
  BN_THOUSAND,
  BN_ZERO,
  signTx,
} from "@mangata-finance/sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { getLiquidityAssetId } from "../../utils/tx";
import { testLog } from "../../utils/Logger";
import { Staking, tokenOriginEnum } from "../../utils/Staking";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Vesting } from "../../utils/Vesting";
import { MPL } from "../../utils/MPL";

let testUser0: User;
let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let candidate: User;
let sudo: User;

let newToken: BN;
let liqId: BN;

describe("Proof of stake tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    sudo = getSudoUser();
    [testUser0, testUser1, testUser2, testUser3, candidate, testUser4] =
      setupUsers();
    newToken = new BN(18);
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
      Assets.mintToken(newToken, testUser0, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser1, Assets.DEFAULT_AMOUNT.muln(40e6)),
      Assets.mintToken(newToken, testUser2, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(newToken, testUser3, Assets.DEFAULT_AMOUNT),
      Assets.mintToken(newToken, testUser4, Assets.DEFAULT_AMOUNT),
      Assets.mintNative(testUser0, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(40e6).muln(2)),
      Assets.mintNative(testUser2),
      Assets.mintNative(testUser3),
      Assets.mintNative(testUser4),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          MGA_ASSET_ID,
          Assets.DEFAULT_AMOUNT.muln(20e6),
          newToken,
          Assets.DEFAULT_AMOUNT.muln(20e6),
        ),
      ),
    );
    liqId = await getLiquidityAssetId(MGA_ASSET_ID, newToken);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(Staking.addStakingLiquidityToken(liqId)),
      Sudo.sudoAs(
        testUser2,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          newToken,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
      Sudo.sudoAs(
        testUser3,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          newToken,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
      Sudo.sudo(
        await Vesting.forceVested(
          sudo.keyRingPair.address,
          testUser4,
          Assets.DEFAULT_AMOUNT.divn(2),
          MGA_ASSET_ID,
          100,
        ),
      ),
      Assets.promotePool(liqId.toNumber(), 20),
      Sudo.sudoAs(
        testUser4,
        Xyk.mintLiquidityUsingVested(
          newToken,
          Assets.DEFAULT_AMOUNT.divn(2),
          Assets.DEFAULT_AMOUNT,
        ),
      ),
      Sudo.sudoAs(
        testUser4,
        MPL.reserveVestingLiquidityTokensByVestingIndex(liqId),
      ),
    );
    testLog.getLog().info("liqId: " + liqId.toString());
  });

  describe("MPL integration", () => {
    beforeAll(async () => {
      await Sudo.batchAsSudoFinalized(
        ...(await ProofOfStake.rewardAndActivatePool(
          newToken,
          testUser0,
          liqId,
          Assets.DEFAULT_AMOUNT,
          null,
        )),
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
    });
    test("User [testUser1] with: stakedUnactivatedReserves ->  stakedAndActivatedReserves -> stakedUnactivatedReserves", async () => {
      await Staking.joinAsCandidateWithUser(candidate, liqId);
      const testUser = testUser1;
      const amountToDelegate = await Staking.delegateWithUser(
        candidate.keyRingPair.address,
        testUser,
        tokenOriginEnum.AvailableBalance,
      );
      const from: PalletProofOfStakeThirdPartyActivationKind = {
        activatekind: "StakedUnactivatedReserves",
      } as any as PalletProofOfStakeThirdPartyActivationKind;
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          amountToDelegate.subn(1),
          newToken,
          from,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      let mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.stakedAndActivatedReserves)).bnEqual(
        amountToDelegate.subn(1),
      );
      expect(new BN(mplStatus.stakedUnactivatedReserves)).bnEqual(BN_ONE);

      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          amountToDelegate.subn(1),
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.stakedUnactivatedReserves)).bnEqual(
        amountToDelegate,
      );
      expect(new BN(mplStatus.stakedAndActivatedReserves)).bnEqual(BN_ZERO);
    });
    test("Bug ? User [testUser2] with: stakedActivatedReserves ->  stakedAndActivatedReserves -> stakedAndActivatedReserves", async () => {
      const testUser = testUser2;
      await Staking.joinAsCandidateWithUser(candidate, liqId);
      const delegatedAmount = await Staking.delegateWithUser(
        candidate.keyRingPair.address,
        testUser,
        tokenOriginEnum.AvailableBalance,
      );
      await signTx(
        getApi(),
        ProofOfStake.activateLiquidity(
          liqId,
          delegatedAmount,
          "StakedUnactivatedReserves",
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const from: PalletProofOfStakeThirdPartyActivationKind =
        "NativeRewardsLiquidity" as any as PalletProofOfStakeThirdPartyActivationKind;
      const activatedAmount = delegatedAmount.sub(BN_THOUSAND);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          activatedAmount,
          newToken,
          from,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      let mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.stakedAndActivatedReserves)).bnEqual(
        delegatedAmount,
      );

      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          activatedAmount,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.stakedAndActivatedReserves)).bnEqual(
        delegatedAmount,
      );
      expect(new BN(mplStatus.stakedUnactivatedReserves)).bnEqual(BN_ZERO);
    });
    test("User [testUser3] with: activatedUnstakedReserves ->  activatedUnstakedReserves -> activatedUnstakedReserves", async () => {
      const testUser = testUser3;
      const testAmount = Assets.DEFAULT_AMOUNT.divn(100);
      await signTx(
        getApi(),
        ProofOfStake.activateLiquidity(
          liqId,
          testAmount,
          tokenOriginEnum.AvailableBalance,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const from: PalletProofOfStakeThirdPartyActivationKind =
        "NativeRewardsLiquidity" as any as PalletProofOfStakeThirdPartyActivationKind;

      const activatedAmount = testAmount.sub(BN_HUNDRED);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          activatedAmount,
          newToken,
          from,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      let mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.activatedUnstakedReserves)).bnEqual(testAmount);
      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          activatedAmount,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.activatedUnstakedReserves)).bnEqual(testAmount);
    });
    test("User [testUser4] with: unspentReserves ->  activatedUnstakedReserves -> unspentReserves", async () => {
      const testUser = testUser4;
      const mintedAmount = Assets.DEFAULT_AMOUNT.divn(2);

      const from: PalletProofOfStakeThirdPartyActivationKind = {
        activatekind: "UnspentReserves",
      } as any as PalletProofOfStakeThirdPartyActivationKind;

      const testAmount = mintedAmount.sub(BN_HUNDRED);
      await signTx(
        getApi(),
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          testAmount,
          newToken,
          from,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      let mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.activatedUnstakedReserves)).bnEqual(testAmount);
      await signTx(
        getApi(),
        await ProofOfStake.deactivateLiquidityFor3rdpartyRewards(
          liqId,
          testAmount,
          newToken,
        ),
        testUser.keyRingPair,
      ).then((events) => {
        const res = getEventResultFromMangataTx(events);
        expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });
      mplStatus = await getMultiPurposeLiquidityStatus(
        testUser.keyRingPair.address,
        liqId,
      );
      expect(new BN(mplStatus.unspentReserves)).bnEqual(mintedAmount);
    });
  });
});
