import { BN } from "@polkadot/util";
import { setupApi } from "./setup";
import { getApi } from "./api";
import {
  PalletProofOfStakeSchedule,
  PalletProofOfStakeThirdPartyActivationKind,
} from "@polkadot/types/lookup";
import { stringToBN } from "./utils";
import { Sudo } from "./sudo";
import { MGA_ASSET_ID } from "./Constants";
import { Assets } from "./Assets";
import { User } from "./User";

export class ProofOfStake {
  static async rewardPool(
    token1: BN,
    token2: BN,
    tokenId: BN,
    amount: BN,
    whenEnding: number,
  ) {
    setupApi();
    const api = getApi();
    const currSession = (await api.query.session.currentIndex()).toNumber();
    return api.tx.proofOfStake.rewardPool(
      [token1, token2],
      tokenId,
      amount,
      currSession + whenEnding,
    );
  }
  static async deactivateLiquidityFor3rdpartyRewards(
    liquidityTokenId: BN,
    amount: BN,
    rewardToken: BN,
  ) {
    await setupApi();
    const api = getApi();
    return api.tx.proofOfStake.deactivateLiquidityFor3rdpartyRewards(
      liquidityTokenId,
      amount,
      rewardToken,
    );
  }
  static async claim3rdpartyRewards(liquidityTokenId: BN, rewardToken: BN) {
    await setupApi();
    const api = getApi();
    return api.tx.proofOfStake.claim3rdpartyRewards(
      liquidityTokenId,
      rewardToken,
    );
  }

  static async activateLiquidityFor3rdpartyRewards(
    liquidityTokenId: BN,
    amount: BN,
    rewardToken: BN,
    useBalanceFrom:
      | PalletProofOfStakeThirdPartyActivationKind
      | null
      | string = null,
  ) {
    setupApi();
    const api = getApi();
    return api.tx.proofOfStake.activateLiquidityFor3rdpartyRewards(
      liquidityTokenId,
      amount,
      rewardToken,
      useBalanceFrom,
    );
  }

  static async activatedLiquidityForSchedules(
    liqId: BN,
    address: string,
    rewardedTokenId: BN,
  ) {
    const value =
      await getApi().query.proofOfStake.activatedLiquidityForSchedules(
        address,
        liqId,
        rewardedTokenId,
      );
    return new BN(value.toString());
  }

  static async scheduleRewardsPerLiquidity() {
    const [value] = await Promise.all([
      getApi().query.proofOfStake.scheduleRewardsPerLiquidity.entries(),
    ]);
    return value;
  }

  static async rewardsSchedulesList(rewardedTokenList: BN[] = []) {
    const value =
      await getApi().query.proofOfStake.rewardsSchedulesList.entries();
    if (rewardedTokenList.length > 0) {
      return value
        .filter((schedules: any[]) => {
          return rewardedTokenList
            .map((x) => x.toString())
            .includes(
              stringToBN(schedules[1].toHuman()[0].rewardToken).toString(),
            );
        })
        .map((x) => (x[1].toHuman() as any)[0] as PalletProofOfStakeSchedule);
    }
    return value.map(
      (x) => (x[1].toHuman() as any[])[0] as PalletProofOfStakeSchedule,
    );
  }

  static async totalActivatedLiquidityForSchedules(
    liqId: BN,
    rewardedToken: BN,
  ) {
    return getApi().query.proofOfStake.totalActivatedLiquidityForSchedules(
      liqId,
      rewardedToken,
    );
  }

  static async rewardsInfoForScheduleRewards(
    userAddress: string,
    liqId: BN,
    rewardedToken: BN,
  ) {
    return getApi().query.proofOfStake.rewardsInfoForScheduleRewards(
      userAddress,
      [liqId, rewardedToken],
    );
  }

  static async rewardAndActivatePool(
    newToken: BN,
    testUser: User,
    liqId: BN,
    amountToActivate: BN = Assets.DEFAULT_AMOUNT.divn(10),
    from: PalletProofOfStakeThirdPartyActivationKind | null | string = null,
  ) {
    return [
      Sudo.sudoAs(
        testUser,
        await ProofOfStake.rewardPool(
          MGA_ASSET_ID,
          newToken,
          newToken,
          Assets.DEFAULT_AMOUNT.muln(10e6),
          3,
        ),
      ),
      Sudo.sudoAs(
        testUser,
        await ProofOfStake.activateLiquidityFor3rdpartyRewards(
          liqId,
          amountToActivate,
          newToken,
          from,
        ),
      ),
    ];
  }

  static async claimNativeRewards(liquidityTokenId: BN) {
    await setupApi();
    const api = getApi();
    return api.tx.proofOfStake.claimNativeRewards(liquidityTokenId);
  }

  static async activateLiquidityForNativeRewards(
    liquidityTokenId: BN,
    amount: BN,
    useBalanceFrom: any = "AvailableBalance",
  ) {
    setupApi();
    const api = getApi();
    return api.tx.proofOfStake.activateLiquidityForNativeRewards(
      liquidityTokenId,
      amount,
      useBalanceFrom,
    );
  }

  static async deactivateLiquidityForNativeRewards(
    liquidityTokenId: BN,
    amount: BN,
  ) {
    await setupApi();
    const api = getApi();
    return api.tx.proofOfStake.deactivateLiquidityForNativeRewards(
      liquidityTokenId,
      amount,
    );
  }
}
