import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";

export class Market {
  static createPool(
    firstAsset: BN,
    firstAssetAmount: BN,
    secondAsset: BN,
    secondAssetAmount: BN,
    kind: any = "Xyk",
  ): Extrinsic {
    return api.tx.market.createPool(
      kind,
      firstAsset,
      firstAssetAmount,
      secondAsset,
      secondAssetAmount,
    );
  }

  static burnLiquidity(
    poolId: BN,
    assetAmount: BN,
    minFirstAssetAmount: BN | number = 0,
    minSecondAssetAmount: BN | number = 0,
  ): Extrinsic {
    return api.tx.market.burnLiquidity(
      poolId,
      assetAmount,
      minFirstAssetAmount,
      minSecondAssetAmount,
    );
  }

  static mintLiquidity(
    poolId: BN,
    assetId: BN,
    assetAmount: BN,
    maxOtherAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER),
  ): Extrinsic {
    return api.tx.market.mintLiquidity(
      poolId,
      assetId,
      assetAmount,
      maxOtherAssetAmount,
    );
  }
}
