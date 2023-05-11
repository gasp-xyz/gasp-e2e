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
}
