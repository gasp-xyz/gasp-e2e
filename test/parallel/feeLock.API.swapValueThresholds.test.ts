/*
 *
 * @group paralgasless
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars, feeLockErrors } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
//let whitelistedTokens: any[];
const thresholdValue = new BN(666);
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await setupApi();

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    null,
    null,
    thresholdValue,
    [
      [MGA_ASSET_ID, true],
      [firstCurrency, true],
    ]
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(sudo),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue
      )
    )
  );

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);
});

test("gasless- Given a feeLock correctly configured WHEN the user swaps two tokens defined in the thresholds AND swapValue > threshold THEN the extrinsic is correctly submitted AND No locks AND no fees", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        MGA_ASSET_ID,
        defaultPoolVolumeValue
      )
    )
  );

  const saleAssetValue = thresholdValue.mul(new BN(2));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userFirstCurLockedValue = testUser1
    .getAsset(firstCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(firstCurrency)?.amountBefore.reserved!
    );

  const userSecondCurLockedValue = testUser1
    .getAsset(secondCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(secondCurrency)?.amountBefore.reserved!
    );

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!
    );

  expect(userFirstCurLockedValue).bnEqual(new BN(0));
  expect(userSecondCurLockedValue).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gasless- Given a feeLock correctly configured WHEN the user swaps two tokens defined in the thresholds AND the user has enough MGAs AND swapValue < threshold THEN some MGAs will be locked", async () => {
  const api = getApi();

  const feeLockAmount = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  ).feeLockAmount;

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        MGA_ASSET_ID,
        defaultPoolVolumeValue
      )
    )
  );

  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userFirstCurLockedValue = testUser1
    .getAsset(firstCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(firstCurrency)?.amountBefore.reserved!
    );

  const userSecondCurLockedValue = testUser1
    .getAsset(secondCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(secondCurrency)?.amountBefore.reserved!
    );

  const userMgaLockedValue = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!
    );

  expect(userFirstCurLockedValue).bnEqual(new BN(0));
  expect(userSecondCurLockedValue).bnEqual(new BN(0));
  expect(userMgaLockedValue).bnEqual(new BN(feeLockAmount));
});

test("gasless- Given a feeLock correctly configured WHEN the user swaps two tokens that are not defined in the thresholds AND the user has not enough MGAs AND swapValue > threshold THEN the extrinsic can not be submited", async () => {
  const mangata = await getMangataInstance();

  const saleAssetValue = thresholdValue.mul(new BN(2));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await expect(
    mangata
      .sellAsset(
        testUser1.keyRingPair,
        firstCurrency.toString(),
        secondCurrency.toString(),
        saleAssetValue,
        new BN(0)
      )
      .catch((reason) => {
        throw new Error(reason.data);
      })
  ).rejects.toThrow(feeLockErrors.FeeLockingFail);
});
