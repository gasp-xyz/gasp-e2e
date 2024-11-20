import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";

export class Market {
  static createPool(
    firstAsset: BN,
    firstAssetAmount: BN,
    secondAsset: BN,
    secondAssetAmount: BN,
  ): Extrinsic {
    return api.tx.market.createPool(
      firstAsset,
      firstAssetAmount,
      secondAsset,
      secondAssetAmount,
    );
  }
}
