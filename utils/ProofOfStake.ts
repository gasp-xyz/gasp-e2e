import { BN } from "@polkadot/util";
import { setupApi } from "./setup";
import { getApi } from "./api";

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
    useBalanceFrom = null,
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
}
