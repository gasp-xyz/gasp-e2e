/*
 *
 * @group xyk
 * @group sequential
 * @group gassless
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { waitSudoOperataionSuccess } from "../../utils/eventListeners";
import { BN, toBN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee } from "../../utils/tx";
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
let feeLockMetadata: any;
let periodLength: any;
let feeLockAmount: any;
let whitelistedTokens: any[];
const thresholdValue = new BN(30000);
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);

async function checkErrorSellAsset(
  reason: string,
  amount = new BN(1000),
  buyMgaToken = true
) {
  let exception = false;
  const mangata = await getMangataInstance();

  if (buyMgaToken) {
    await expect(
      mangata
        .sellAsset(
          testUser1.keyRingPair,
          createdToken.toString(),
          MGA_ASSET_ID.toString(),
          amount,
          new BN(0)
        )
        .catch((reason) => {
          exception = true;
          throw new Error(reason.data);
        })
    ).rejects.toThrow(reason);
  } else {
    await expect(
      mangata
        .sellAsset(
          testUser1.keyRingPair,
          MGA_ASSET_ID.toString(),
          createdToken.toString(),
          amount,
          new BN(0)
        )
        .catch((reason) => {
          exception = true;
          throw new Error(reason.data);
        })
    ).rejects.toThrow(reason);
  }
  expect(exception).toBeTruthy();
}

async function clearMgaFromWhitelisted() {
  let checkMgaWhitelistedToken: boolean;
  const swapValueThreshold = feeLockMetadata.swapValueThreshold;
  whitelistedTokens = feeLockMetadata.whitelistedTokens;
  checkMgaWhitelistedToken = false;

  whitelistedTokens.forEach((element) => {
    if (element.toString() === MGA_ASSET_ID.toString()) {
      checkMgaWhitelistedToken = true;
    }
  });

  if (checkMgaWhitelistedToken) {
    const checkEmptyTimeoutConfig = await updateFeeLockMetadata(
      sudo,
      new BN(periodLength),
      new BN(feeLockAmount),
      swapValueThreshold,
      [[MGA_ASSET_ID, false]]
    );
    await waitSudoOperataionSuccess(checkEmptyTimeoutConfig);
  }
}

async function addMgaToWhitelisted() {
  let checkMgaWhitelistedToken: boolean;
  const swapValueThreshold = feeLockMetadata.swapValueThreshold;
  whitelistedTokens = feeLockMetadata.whitelistedTokens;
  checkMgaWhitelistedToken = false;

  whitelistedTokens.forEach((element) => {
    if (element.toString() === MGA_ASSET_ID.toString()) {
      checkMgaWhitelistedToken = true;
    }
  });

  if (swapValueThreshold < thresholdValue) {
    checkMgaWhitelistedToken = false;
  }

  if (!checkMgaWhitelistedToken) {
    const updateMgaTimeoutMetadata = await updateFeeLockMetadata(
      sudo,
      new BN(periodLength),
      new BN(feeLockAmount),
      thresholdValue,
      [[MGA_ASSET_ID, true]]
    );
    await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);
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

  feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );

  periodLength = feeLockMetadata.periodLength.toString();
  feeLockAmount = feeLockMetadata.feeLockAmount.toString();
});

test("gassless- GIVEN a feeLock configured WHEN a swap happens THEN fees are not charged but locked instead", async () => {
  await addMgaToWhitelisted();

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, createdToken, sellAssetsValue);
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
    .add(new BN(feeLockMetadata.feeLockAmount.toString()))
    .add(new BN(sellAssetsValue));

  expect(tokenFees).bnEqual(new BN(feeLockMetadata.feeLockAmount.toString()));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- GIVEN a feeLock configured (only Time and Amount ) WHEN the user swaps AND the user has not enough MGAs and has enough TURs THEN the extrinsic fails on submission", async () => {
  await clearMgaFromWhitelisted();

  await testUser1.addTURTokens(sudo);
  await testUser1.addMGATokens(sudo, new BN(2));

  await checkErrorSellAsset(
    "1010: Invalid Transaction: Fee lock processing has failed either due to not enough funds to reserve or an unexpected error"
  );
});

test("gassless- GIVEN a feeLock configured (only Time and Amount )  WHEN the user swaps AND the user does not have enough MGAs THEN the extrinsic fails on submission", async () => {
  await clearMgaFromWhitelisted();

  await testUser1.addMGATokens(sudo, new BN(2));

  await checkErrorSellAsset(
    "1010: Invalid Transaction: Fee lock processing has failed either due to not enough funds to reserve or an unexpected error"
  );
});

test("gassless- Given a feeLock correctly configured (only Time and Amount ) WHEN the user swaps AND the user has enough MGAs THEN the extrinsic is correctly submitted", async () => {
  await clearMgaFromWhitelisted();

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  const sellAssetsValue = thresholdValue.add(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, createdToken, sellAssetsValue);
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
    .add(new BN(sellAssetsValue));

  expect(tokenFees).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- GIVEN a correct config for gassless swaps WHEN the user runs unlock-fee THEN fees are charged", async () => {
  await addMgaToWhitelisted();

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, createdToken, sellAssetsValue);
  await waitForNBlocks(periodLength);
  await unlockFee(testUser1);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const tokenBlocked = testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!;

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    )
    .add(new BN(sellAssetsValue));

  expect(tokenBlocked).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- High-value swaps are rejected from the txn pool if they would fail before the percentage fee is charged", async () => {
  await addMgaToWhitelisted();

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);

  await checkErrorSellAsset(
    "1010: Invalid Transaction: The swap prevalidation has failed",
    toBN("1", 26),
    false
  );
});

test("gassless- High-value swaps when successful are not charged txn fee or token timedout, but the percentage fee is charged", async () => {
  const additionalToken = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(additionalToken, sudo, defaultCurrencyValue),
    Assets.mintToken(additionalToken, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        createdToken,
        defaultPoolVolumeValue,
        additionalToken,
        defaultPoolVolumeValue
      )
    )
  );

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(createdToken);
  testUser1.addAsset(additionalToken);

  const updateMgaTimeoutMetadata = await updateFeeLockMetadata(
    sudo,
    new BN(periodLength),
    new BN(feeLockAmount),
    thresholdValue,
    [
      [MGA_ASSET_ID, true],
      [createdToken, true],
    ]
  );
  await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);

  const sellAssetsValue = thresholdValue.add(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(createdToken, additionalToken, sellAssetsValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
    );

  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- For low-value swaps, token reservation status and pallet storage are altered in accordance with the timeout mechanism", async () => {
  let accountFeeLockAmount: any;
  const api = getApi();

  async function checkAccountFeeLockAmount(value: any) {
    accountFeeLockAmount = JSON.parse(
      JSON.stringify(
        await api.query.feeLock.accountFeeLockData(
          testUser1.keyRingPair.address
        )
      )
    ).totalFeeLockAmount;
    expect(new BN(accountFeeLockAmount)).bnEqual(new BN(value));
  }

  await addMgaToWhitelisted();

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);
  await checkAccountFeeLockAmount(0);

  const sellAssetsValue = thresholdValue.sub(new BN(5));
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, createdToken, sellAssetsValue);
  await waitForNBlocks(periodLength);
  await checkAccountFeeLockAmount(feeLockAmount);

  await unlockFee(testUser1);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await checkAccountFeeLockAmount(0);
});
