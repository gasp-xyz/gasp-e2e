/*
 *
 * @group xyk
 * @group sequential
 * @group gassless
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID, TUR_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  waitSudoOperataionSuccess,
} from "../../utils/eventListeners";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateTimeoutMetadata, releaseTimeout } from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let createdToken: BN;
let timeoutMetadata: any;
let periodLength: any;
let timeoutAmount: any;
const thresholdValue = new BN(30000);
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);

async function clearMgaSwapValueThreshold() {
  const swapValueThreshold = timeoutMetadata.swapValueThreshold;

  if (swapValueThreshold[MGA_ASSET_ID.toString()] > 0) {
    const checkEmptyTimeoutConfig = await updateTimeoutMetadata(
      sudo,
      new BN(periodLength),
      new BN(timeoutAmount),
      [[MGA_ASSET_ID, new BN(0)]]
    );
    await waitSudoOperataionSuccess(checkEmptyTimeoutConfig);
  }
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  await sudo.addMGATokens(sudo);
});

beforeEach(async () => {
  const api = getApi();

  [testUser1] = setupUsers();

  await setupApi();

  createdToken = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(createdToken, sudo, defaultCurrencyValue),
    Assets.mintToken(createdToken, testUser1, defaultCurrencyValue),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultPoolVolumeValue,
        createdToken,
        defaultPoolVolumeValue
      )
    )
  );

  timeoutMetadata = JSON.parse(
    JSON.stringify(await api.query.tokenTimeout.timeoutMetadata())
  );

  periodLength = timeoutMetadata.periodLength.toString();
  timeoutAmount = timeoutMetadata.timeoutAmount.toString();
});

test("gassless- GIVEN a tokenTimeout configured WHEN a swap happens THEN fees are not charged but locked instead", async () => {
  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  const updateMgaTimeoutMetadata = await updateTimeoutMetadata(
    sudo,
    new BN(periodLength),
    new BN(timeoutAmount),
    [
      [MGA_ASSET_ID, thresholdValue],
      [createdToken, thresholdValue],
    ]
  );
  await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);

  const buyAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, createdToken, buyAssetsValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const tokenFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!
    );

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    )
    .add(new BN(timeoutMetadata.timeoutAmount.toString()))
    .add(new BN(buyAssetsValue));

  expect(tokenFees).bnEqual(new BN(timeoutMetadata.timeoutAmount.toString()));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- GIVEN a tokenTimeout configured (only Time and Amount ) WHEN the user swaps AND the user has not enough MGAs but enough TURs THEN the extrinsic is correctly submitted", async () => {
  await clearMgaSwapValueThreshold();

  await testUser1.addTURTokens(sudo);
  await testUser1.addMGATokens(sudo, new BN(2));
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(TUR_ASSET_ID);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.buyAssets(createdToken, MGA_ASSET_ID, new BN(1000));
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const tokenFees = testUser1
    .getAsset(TUR_ASSET_ID)
    ?.amountBefore.free!.sub(
      testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!
    );

  expect(tokenFees).bnEqual(new BN(0));
  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!).bnEqual(
    new BN(1000)
  );
});

test("gassless- GIVEN a tokenTimeout configured (only Time and Amount )  WHEN the user swaps AND the user does not have enough MGAs THEN the extrinsic fails on submission", async () => {
  await clearMgaSwapValueThreshold();

  await testUser1.addMGATokens(sudo, new BN(2));
  testUser1.addAsset(MGA_ASSET_ID);

  await testUser1
    .buyAssets(createdToken, MGA_ASSET_ID, new BN(1000))
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });
});

test("gassless- GIVEN a correct config for gass less swaps WHEN the user runs release-timeout THEN fees are charged", async () => {
  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  const updateMgaTimeoutMetadata = await updateTimeoutMetadata(
    sudo,
    new BN(periodLength),
    new BN(timeoutAmount),
    [
      [MGA_ASSET_ID, thresholdValue],
      [createdToken, thresholdValue],
    ]
  );
  await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);

  const buyAssetsValue = thresholdValue.div(new BN(100));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, createdToken, buyAssetsValue);
  await waitForNBlocks(periodLength);
  await releaseTimeout(sudo);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const tokenBlocked = testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!;

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    )
    .add(new BN(timeoutMetadata.timeoutAmount.toString()))
    .add(new BN(buyAssetsValue));

  expect(tokenBlocked).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});

// test("xyk-pallet-gassless GIVEN a tokenTimeout configured WHEN the user swaps two tokens defined in the thresholds AND swapValue > threshold THEN the extrinsic is correctly submitted AND No locks AND no fees", async () => {
//   await checkTimeoutSettings();

//   const sellAssetsValue = thresholdValue.add(new BN(10000));

//   await testUser1.refreshAmounts(AssetWallet.BEFORE);
//   await testUser1.sellAssets(MGA_ASSET_ID, createdToken, sellAssetsValue);
//   await testUser1.refreshAmounts(AssetWallet.AFTER);

//   const tokenFees = testUser1
//     .getAsset(MGA_ASSET_ID)
//     ?.amountBefore.free.sub(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!)
//     .sub(defaultSwapValue);

//   expect(tokenFees).bnEqual(new BN(0));
// });
