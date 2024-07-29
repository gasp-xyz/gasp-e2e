import { BN_ZERO } from "gasp-sdk";
import { BN } from "@polkadot/util";

import { api } from "./setup";

export class MPL {
  static unreserveAndRelockInstance(tokenId: BN, vestingIndex: BN) {
    return api.tx.multiPurposeLiquidity.unreserveAndRelockInstance(
      tokenId,
      vestingIndex,
    );
  }
  static reserveVestingNativeTokensByVestingIndex(
    tokenId: BN,
    amount = BN_ZERO,
  ) {
    if (amount.gt(BN_ZERO)) {
      return api.tx.multiPurposeLiquidity.reserveVestingNativeTokensByVestingIndex(
        tokenId,
        amount,
      );
    } else {
      return api.tx.multiPurposeLiquidity.reserveVestingNativeTokensByVestingIndex(
        tokenId,
        api.createType("Option<u128>", null),
      );
    }
  }
  static reserveVestingLiquidityTokensByVestingIndex(
    tokenId: BN,
    index = 0,
    amount = BN_ZERO,
  ) {
    if (amount.gt(BN_ZERO)) {
      return api.tx.multiPurposeLiquidity.reserveVestingLiquidityTokensByVestingIndex(
        tokenId,
        index,
        amount,
      );
    } else {
      return api.tx.multiPurposeLiquidity.reserveVestingLiquidityTokensByVestingIndex(
        tokenId,
        index,
        api.createType("Option<u128>", null),
      );
    }
  }
}
