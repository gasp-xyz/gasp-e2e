import { BN_ZERO } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";

export class Xyk {
  static createPool(
    firstAsset: BN,
    firstAssetAmount: BN,
    secondAsset: BN,
    secondAssetAmount: BN
  ): Extrinsic {
    return api.tx.xyk.createPool(
      firstAsset,
      firstAssetAmount,
      secondAsset,
      secondAssetAmount
    );
  }

  static mintLiquidity(
    firstAsset: BN,
    secondAsset: BN,
    firstAssetAmount: BN,
    expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER)
  ): Extrinsic {
    return api.tx.xyk.mintLiquidity(
      firstAsset,
      secondAsset,
      firstAssetAmount,
      expectedSecondAssetAmount
    );
  }

  static burnLiquidity(
    firstAsset: BN,
    secondAsset: BN,
    assetAmount: BN
  ): Extrinsic {
    return api.tx.xyk.burnLiquidity(firstAsset, secondAsset, assetAmount);
  }

  static sellAsset(
    soldAssetId: BN,
    boughtAssetId: BN,
    soldAssetAmount: BN,
    minBoughtOut: BN = BN_ZERO
  ): Extrinsic {
    return api.tx.xyk.sellAsset(
      soldAssetId,
      boughtAssetId,
      soldAssetAmount,
      minBoughtOut
    );
  }

  static buyAsset(
    soldAssetId: BN,
    boughtAssetId: BN,
    boughtAssetAmount: BN,
    maxAmountIn: BN = new BN(Number.MAX_SAFE_INTEGER)
  ): Extrinsic {
    return api.tx.xyk.buyAsset(
      soldAssetId,
      boughtAssetId,
      boughtAssetAmount,
      maxAmountIn
    );
  }
}
