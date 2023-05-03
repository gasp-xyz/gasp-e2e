import { BN } from "@mangata-finance/sdk";
import { api, Extrinsic } from "./setup";

export class Staking {
  static addStakingLiquidityToken(liqToken: BN): Extrinsic {
    return api.tx.parachainStaking.addStakingLiquidityToken(
      {
        Liquidity: liqToken,
      },
      liqToken
    );
  }
  static aggregatorUpdateMetadata(
    collatorCandidates: string[],
    action = "ExtendApprovedCollators"
  ): Extrinsic {
    return api.tx.parachainStaking.aggregatorUpdateMetadata(
      collatorCandidates,
      action
    );
  }
  static updateCandidateAggregator(maybeAggregatorAddress: string): Extrinsic {
    return api.tx.parachainStaking.updateCandidateAggregator(
      maybeAggregatorAddress
    );
  }
}
