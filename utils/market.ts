import { BN, BN_ZERO } from "@polkadot/util";
import { api, Extrinsic } from "./setup";
import { User } from "./User";
import { getLiquidityAssetId } from "./tx";
import { filterAndStringifyFirstEvent } from "./eventListeners";
import { MangataGenericEvent } from "gasp-sdk";
import { stringToBN } from "./utils";

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

  static buyAsset(
    swapPool: BN,
    soldAssetId: BN,
    boughtAssetId: BN,
    boughtAssetAmount: BN,
    maxAmountIn: BN = new BN("340282366920938463463374607431768211455"), //u128::MAX,
  ): Extrinsic {
    return api.tx.market.multiswapAssetBuy(
      [swapPool],
      boughtAssetId,
      boughtAssetAmount,
      soldAssetId,
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

  static sellAsset(
    swapPool: BN,
    soldAssetId: BN,
    boughtAssetId: BN,
    soldAssetAmount: BN,
    minBoughtOut: BN = BN_ZERO,
  ): Extrinsic {
    return api.tx.market.multiswapAsset(
      [swapPool],
      soldAssetId,
      soldAssetAmount,
      boughtAssetId,
      minBoughtOut,
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

export async function getMintLiquidityPaymentInfo(
  user: User,
  firstCurrency: BN,
  secondCurrency: BN,
  assetAmount: BN,
  maxOtherAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER),
) {
  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const mintLiquidityEvent = api.tx.market.mintLiquidity(
    liqId,
    firstCurrency,
    assetAmount,
    maxOtherAssetAmount,
  );

  const mintLiquidityPaymentInfo = await mintLiquidityEvent.paymentInfo(
    user.keyRingPair,
  );
  return mintLiquidityPaymentInfo;
}

export async function getTransactionFeeInfo(event: MangataGenericEvent[]) {
  const transactionFeePaid = await filterAndStringifyFirstEvent(
    event,
    "TransactionFeePaid",
  );
  const actualFee = await stringToBN(transactionFeePaid.actualFee);
  return actualFee;
}

export async function getPoolIdsInfo(tokenIds: BN[]) {
  const swapPoolList: BN[] = [];
  let i: number = 0;
  let liqId: BN;
  const tokenIdsLength = tokenIds.length;
  const firstToken = tokenIds[0];
  const lastToken = tokenIds[tokenIdsLength - 1];
  while (i < tokenIdsLength - 1) {
    liqId = await getLiquidityAssetId(tokenIds[i], tokenIds[i + 1]);
    swapPoolList.push(liqId);
    i++;
  }
  return { swapPoolList, firstToken, lastToken };
}

export async function getPoolsForTrading() {
  const data = JSON.parse(
    JSON.stringify(await api.rpc.market.get_pools_for_trading()),
  );
  return data;
}

export async function getTradeableTokens() {
  const data = JSON.parse(
    JSON.stringify(await api.rpc.market.get_tradeable_tokens()),
  );
  return data;
}

export async function getBurnAmount(poolId: BN, lpBurnAmount: BN) {
  const data = JSON.parse(
    JSON.stringify(await api.rpc.market.get_burn_amount(poolId, lpBurnAmount)),
  );
  return {
    firstTokenAmount: stringToBN(data[0]),
    secondTokenAmount: stringToBN(data[1]),
  };
}

export async function calculateExpectedLiquidityMinted(
  poolId: BN,
  assetId: BN,
  assetAmount: BN,
) {
  const expectedSecondAmount = JSON.parse(
    JSON.stringify(
      await api.rpc.market.calculate_expected_amount_for_minting(
        poolId,
        assetId,
        assetAmount,
      ),
    ),
  );

  const expectedLiquidity = JSON.parse(
    JSON.stringify(
      await api.rpc.market.calculate_expected_lp_minted(poolId, [
        assetAmount,
        expectedSecondAmount,
      ]),
    ),
  );
  return {
    expectedSecondAmount: stringToBN(expectedSecondAmount),
    expectedLiquidity: stringToBN(expectedLiquidity),
  };
}

export async function getPoolId(firstAsset: BN, secondAsset: BN) {
  let index = 0;
  let result: any = [];

  const events = JSON.parse(
    JSON.stringify(await api.rpc.market.get_pools(null)),
  );

  const length = events.length;

  while (index < length) {
    if (
      (events[index].assets[0] === firstAsset.toNumber() &&
        events[index].assets[1] === secondAsset.toNumber()) ||
      (events[index].assets[0] === secondAsset.toNumber() &&
        events[index].assets[1] === firstAsset.toNumber())
    ) {
      result = events[index];
    }
    index++;
  }
  return stringToBN(result.lpTokenId.toString());
}
