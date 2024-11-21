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
}
