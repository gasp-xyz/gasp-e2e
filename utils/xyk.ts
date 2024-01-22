import { BN_ZERO } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";

export class Xyk {
  static createPool(
    firstAsset: BN,
    firstAssetAmount: BN,
    secondAsset: BN,
    secondAssetAmount: BN,
  ): Extrinsic {
    return api.tx.xyk.createPool(
      firstAsset,
      firstAssetAmount,
      secondAsset,
      secondAssetAmount,
    );
  }

  static mintLiquidity(
    firstAsset: BN,
    secondAsset: BN,
    firstAssetAmount: BN,
    expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER),
  ): Extrinsic {
    return api.tx.xyk.mintLiquidity(
      firstAsset,
      secondAsset,
      firstAssetAmount,
      expectedSecondAssetAmount,
    );
  }

  static burnLiquidity(
    firstAsset: BN,
    secondAsset: BN,
    assetAmount: BN,
  ): Extrinsic {
    return api.tx.xyk.burnLiquidity(firstAsset, secondAsset, assetAmount);
  }

  static sellAsset(
    soldAssetId: BN,
    boughtAssetId: BN,
    soldAssetAmount: BN,
    minBoughtOut: BN = BN_ZERO,
  ): Extrinsic {
    return api.tx.xyk.sellAsset(
      soldAssetId,
      boughtAssetId,
      soldAssetAmount,
      minBoughtOut,
    );
  }

  static buyAsset(
    soldAssetId: BN,
    boughtAssetId: BN,
    boughtAssetAmount: BN,
    maxAmountIn: BN = new BN("340282366920938463463374607431768211455"), //u128::MAX
  ): Extrinsic {
    return api.tx.xyk.buyAsset(
      soldAssetId,
      boughtAssetId,
      boughtAssetAmount,
      maxAmountIn,
    );
  }
  static multiswapBuyAsset(
    tokenIds: BN[],
    buyAmount: BN,
    maxAmountIn: BN,
  ): Extrinsic {
    return api.tx.xyk.multiswapBuyAsset(tokenIds, buyAmount, maxAmountIn);
  }
  static multiswapSellAsset(
    tokenIds: BN[],
    buyAmount: BN,
    minAmountOut: BN,
  ): Extrinsic {
    return api.tx.xyk.multiswapSellAsset(tokenIds, buyAmount, minAmountOut);
  }

  static compoundRewards(
    liquidityAssetId: BN,
    amountPermille: number = 1000000,
  ): Extrinsic {
    return api.tx.xyk.compoundRewards(liquidityAssetId, amountPermille);
  }

  static provideLiquidity(
    liquidityAssetId: BN,
    providedAssetId: BN,
    providedAssetAmount: any,
  ): Extrinsic {
    return api.tx.xyk.provideLiquidityWithConversion(
      liquidityAssetId,
      providedAssetId,
      providedAssetAmount,
    );
  }

  static mintLiquidityUsingVested(
    tokenId: BN,
    vestingTokensAmount: BN,
    expectedSecondAssetAmount: BN,
  ) {
    return api.tx.xyk.mintLiquidityUsingVestingNativeTokens(
      vestingTokensAmount,
      tokenId.toString(),
      expectedSecondAssetAmount,
    );
  }
}

export class Tokens {
  static transfer(dest: string, tokenId: BN, amount: BN): Extrinsic {
    return api.tx.tokens.transfer(dest, tokenId, amount);
  }
}
