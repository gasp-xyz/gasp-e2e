import { BN } from "@mangata-finance/sdk";
import { ApiPromise } from "@polkadot/api";
import { MGA_ASSET_ID } from "./Constants";
import { waitSudoOperataionSuccess } from "./eventListeners";
import { updateFeeLockMetadata } from "./tx";
import { User } from "./User";

export async function clearMgaFromWhitelisted(api: ApiPromise, sudo: User) {
  const feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );
  // [].includes( (element:any) => { element.toString() === MGA_ASSET_ID.toString() } )
  feeLockMetadata.whitelistedTokens.forEach(async (element: any) => {
    if (element.toString() === MGA_ASSET_ID.toString()) {
      const checkEmptyTimeoutConfig = await updateFeeLockMetadata(
        sudo,
        new BN(feeLockMetadata.periodLength),
        new BN(feeLockMetadata.feeLockAmount),
        feeLockMetadata.swapValueThreshold,
        [MGA_ASSET_ID, false]
      );
      await waitSudoOperataionSuccess(checkEmptyTimeoutConfig);
    }
  });
}

export async function addMgaToWhitelisted(
  api: ApiPromise,
  thresholdValueExpected: BN,
  sudo: User
) {
  let isWhitelistedAlreadySetup = false;

  const feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );
  const swapValueThreshold = new BN(feeLockMetadata.swapValueThreshold);
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
    const updateMgaTimeoutMetadata = await updateFeeLockMetadata(
      sudo,
      new BN(feeLockMetadata.periodLength),
      new BN(feeLockMetadata.feeLockAmount),
      thresholdValueExpected,
      [[MGA_ASSET_ID, true]]
    );
    await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);
  }
}
