import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { getLiquidityAssetId } from "./tx";

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

  static mintLiquidityUsingVested(
    poolId: BN,
    nativeAssetVestingAmount: BN,
    maxOtherAssetAmount: BN,
  ) {
    return api.tx.market.mintLiquidityUsingVestingNativeTokens(
      poolId,
      nativeAssetVestingAmount,
      maxOtherAssetAmount,
    );
  }

  static multiswapAssetBuy(
    swapPoolList: BN[],
    assetIdOut: BN,
    assetAmountOut: BN,
    assetIdIn: BN,
    maxAmountIn: BN,
  ): Extrinsic {
    return api.tx.market.multiswapAssetBuy(
      swapPoolList,
      assetIdOut,
      assetAmountOut,
      assetIdIn,
      maxAmountIn,
    );
  }

  static multiswapAssetSell(
    swapPoolList: BN[],
    assetIdIn: BN,
    assetAmountIn: BN,
    assetIdOut: BN,
    minAmountOut: BN,
  ): Extrinsic {
    return api.tx.market.multiswapAsset(
      swapPoolList,
      assetIdIn,
      assetAmountIn,
      assetIdOut,
      minAmountOut,
    );
  }

  static buyAsset(
    soldAssetId: BN,
    boughtAssetId: BN,
    boughtAssetAmount: BN,
    maxAmountIn: BN = new BN("340282366920938463463374607431768211455"), //u128::MAX,
  ): Extrinsic {
    const liqId = getLiquidityAssetId(soldAssetId, boughtAssetId);
    return api.tx.market.multiswapAssetBuy(
      [liqId],
      soldAssetId,
      boughtAssetAmount,
      boughtAssetId,
      maxAmountIn,
    );
  }

  static sellAsset(
    swapPoolList: BN[],
    assetIdIn: BN,
    assetAmountIn: BN,
    assetIdOut: BN,
    minAmountOut: BN,
  ): Extrinsic {
    return api.tx.market.multiswapAsset(
      swapPoolList,
      assetIdIn,
      assetAmountIn,
      assetIdOut,
      minAmountOut,
    );
  }
}

export async function getMultiswapSellPaymentInfo(
  user: User,
  tokenIds: BN[],
  assetAmountIn: BN,
  minAmountOut: BN,
) {
  let liqId: BN;
  let i = 0;

  const tokenIdsLength = tokenIds.length;
  const firstToken = tokenIds[0];
  const lastToken = tokenIds[tokenIdsLength - 1];
  const swapPoolList: BN[] = [];
  while (i < tokenIdsLength - 1) {
    liqId = await getLiquidityAssetId(tokenIds[i], tokenIds[i + 1]);
    swapPoolList.push(liqId);
    i++;
  }

  const multiswapSellEvent = await Market.multiswapAssetSell(
    swapPoolList,
    firstToken,
    assetAmountIn,
    lastToken,
    minAmountOut,
  );
  const multiswapSellPaymentInfo = await multiswapSellEvent.paymentInfo(
    user.keyRingPair,
  );
  return multiswapSellPaymentInfo.partialFee;
}
