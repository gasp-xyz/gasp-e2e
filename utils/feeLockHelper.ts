import { getApi } from "./api";
import { GASP_ASSET_ID } from "./Constants";
import { waitSudoOperationSuccess } from "./eventListeners";
import {
  rpcCalculateBuyPriceMulti,
  rpcCalculateSellPriceMulti,
  updateFeeLockMetadata,
} from "./tx";
import { User } from "./User";
import { stringToBN } from "./utils";
import { BN } from "@polkadot/util";
import { Market } from "./market";

export async function clearMgaFromWhitelisted(
  thresholdValueExpected: BN,
  sudo: User,
) {
  const api = getApi();
  const feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata()),
  );
  const swapValueThreshold = stringToBN(feeLockMetadata.swapValueThreshold);
  const isMgaWhitelisted = feeLockMetadata.whitelistedTokens.includes(
    GASP_ASSET_ID.toNumber(),
  );

  if (isMgaWhitelisted || swapValueThreshold.lt(thresholdValueExpected)) {
    const updateMetadataEvent = await updateFeeLockMetadata(
      sudo,
      new BN(feeLockMetadata.periodLength),
      new BN(feeLockMetadata.feeLockAmount),
      thresholdValueExpected,
      [[GASP_ASSET_ID, false]],
    );
    await waitSudoOperationSuccess(updateMetadataEvent);
  }
}

export async function addMgaToWhitelisted(
  thresholdValueExpected: BN,
  sudo: User,
) {
  const api = getApi();

  let isWhitelistedAlreadySetup = false;

  const feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata()),
  );
  const swapValueThreshold = stringToBN(feeLockMetadata.swapValueThreshold);
  const whitelistedTokens = feeLockMetadata.whitelistedTokens;

  whitelistedTokens.forEach((element: any) => {
    if (
      element.toString() === GASP_ASSET_ID.toString() &&
      swapValueThreshold.gte(thresholdValueExpected)
    ) {
      isWhitelistedAlreadySetup = true;
    }
  });
  if (!isWhitelistedAlreadySetup) {
    const updateMetadataEvent = await updateFeeLockMetadata(
      sudo,
      new BN(feeLockMetadata.periodLength),
      stringToBN(feeLockMetadata.feeLockAmount),
      thresholdValueExpected,
      [[GASP_ASSET_ID, true]],
    );
    await waitSudoOperationSuccess(updateMetadataEvent);
  }
}

export async function getFeeLockMetadata() {
  const api = getApi();
  return (await api.query.feeLock.feeLockMetadata()).value;
}
export async function rpcCalculateSellPrice(
  poolId: BN | BN[],
  sellAssetId: BN,
  sellAmount: BN,
) {
  const param = Array.isArray(poolId) ? poolId[0] : poolId;
  const pool = await Market.getPool(param);
  const secToken = pool[0].assets[0].eq(sellAssetId)
    ? pool[0].assets[1]
    : pool[0].assets[0];
  return rpcCalculateSellPriceMulti(param, sellAssetId, sellAmount, secToken);
}

export async function rpcCalculateBuyPrice(
  poolId: BN,
  buyAssetId: BN,
  buyAmount: BN,
) {
  const pool = await Market.getPool(poolId);
  const secToken = pool[0].assets[0].eq(buyAssetId)
    ? pool[0].assets[1]
    : pool[0].assets[0];
  return rpcCalculateBuyPriceMulti(poolId, buyAssetId, buyAmount, secToken);
}
export async function rpcCalculateSellPriceNoFee(
  poolId: BN,
  sellAssetId: BN,
  sellAmount: BN,
) {
  const api = getApi();
  const value = await api.rpc.market.calculate_sell_price(
    poolId,
    sellAssetId,
    sellAmount,
  );
  return stringToBN(value.toString());
}
export async function rpcCalculateBuyPriceNoFees(
  poolId: BN,
  buyAssetId: BN,
  buyAmount: BN,
) {
  const api = getApi();
  const value = await api.rpc.market.calculate_buy_price(
    poolId,
    buyAssetId,
    buyAmount,
  );
  return stringToBN(value.toString());
}
export async function rpcCalculateSellPriceWithImpact(
  poolId: BN,
  sellAssetId: BN,
  sellAmount: BN,
) {
  const api = getApi();
  const value = JSON.parse(
    JSON.stringify(
      await api.rpc.market.calculate_sell_price_with_impact(
        poolId,
        sellAssetId,
        sellAmount,
      ),
    ),
  );
  return {
    firstIteration: stringToBN(value[0]),
    secondIteration: stringToBN(value[1]),
  };
}

export async function rpcCalculateBuyPriceWithImpact(
  poolId: BN,
  buyAssetId: BN,
  sellAmount: BN,
) {
  const api = getApi();
  const value = JSON.parse(
    JSON.stringify(
      await api.rpc.market.calculate_buy_price_with_impact(
        poolId,
        buyAssetId,
        sellAmount,
      ),
    ),
  );
  return {
    firstIteration: stringToBN(value[0]),
    secondIteration: stringToBN(value[1]),
  };
}
