import { getApi } from "./api";
import { GASP_ASSET_ID } from "./Constants";
import { waitSudoOperationSuccess } from "./eventListeners";
import { updateFeeLockMetadata } from "./tx";
import { User } from "./User";
import { stringToBN } from "./utils";
import { BN } from "@polkadot/util";

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
  const value = (await api.query.feeLock.feeLockMetadata()).value;
  return value;
}

export async function calculateSellPriceByMarket(
  poolId: BN,
  sellAssetId: BN,
  sellAmount: BN,
) {
  const api = getApi();
  const value = stringToBN(
    JSON.parse(
      JSON.stringify(
        await api.rpc.market.calculate_sell_price(
          poolId,
          sellAssetId,
          sellAmount,
        ),
      ),
    ),
  );
  return value;
}

export async function calculateBuyPriceByMarket(
  poolId: BN,
  buyAssetId: BN,
  sellAmount: BN,
) {
  const api = getApi();
  const value = stringToBN(
    JSON.parse(
      JSON.stringify(
        await api.rpc.market.calculate_buy_price(
          poolId,
          buyAssetId,
          sellAmount,
        ),
      ),
    ),
  );
  return value;
}

export async function calculateSellPriceWithImpact(
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
  return [stringToBN(value[0]), stringToBN(value[1])];
}

export async function calculateBuyPriceWithImpact(
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
  return [stringToBN(value[0]), stringToBN(value[1])];
}
