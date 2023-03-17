import { BN } from "@mangata-finance/sdk";
import { getApi } from "./api.js";
import { MGA_ASSET_ID } from "./Constants.js";
import { waitSudoOperationSuccess } from "./eventListeners.js";
import { updateFeeLockMetadata } from "./tx.js";
import { User } from "./User.js";
import { stringToBN } from "./utils.js";

export async function clearMgaFromWhitelisted(
  thresholdValueExpected: BN,
  sudo: User
) {
  const api = getApi();
  const feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );
  const swapValueThreshold = stringToBN(feeLockMetadata.swapValueThreshold);
  const isMgaWhitelisted = feeLockMetadata.whitelistedTokens.includes(
    MGA_ASSET_ID.toNumber()
  );

  if (isMgaWhitelisted || swapValueThreshold.lt(thresholdValueExpected)) {
    const updateMetadataEvent = await updateFeeLockMetadata(
      sudo,
      new BN(feeLockMetadata.periodLength),
      new BN(feeLockMetadata.feeLockAmount),
      thresholdValueExpected,
      [[MGA_ASSET_ID, false]]
    );
    await waitSudoOperationSuccess(updateMetadataEvent);
  }
}

export async function addMgaToWhitelisted(
  thresholdValueExpected: BN,
  sudo: User
) {
  const api = getApi();

  let isWhitelistedAlreadySetup = false;

  const feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );
  const swapValueThreshold = stringToBN(feeLockMetadata.swapValueThreshold);
  const whitelistedTokens = feeLockMetadata.whitelistedTokens;

  whitelistedTokens.forEach((element: any) => {
    if (
      element.toString() === MGA_ASSET_ID.toString() &&
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
      [[MGA_ASSET_ID, true]]
    );
    await waitSudoOperationSuccess(updateMetadataEvent);
  }
}
