/*
 *
 * @group sequential
 * @group gassless
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  waitSudoOperataionSuccess,
  ExtrinsicResult,
} from "../../utils/eventListeners";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, createPool } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
let feeLockMetadata: any;
let periodLength: any;
let feeLockAmount: any;
//let whitelistedTokens: any[];
const thresholdValue = new BN(30000);
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

  await sudo.addMGATokens(sudo);
});

beforeEach(async () => {
  const api = getApi();

  [testUser1] = setupUsers();

  await setupApi();

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );

  periodLength = feeLockMetadata.periodLength;
  feeLockAmount = feeLockMetadata.feeLockAmount;

  const updateMgaTimeoutMetadata = await updateFeeLockMetadata(
    sudo,
    new BN(periodLength),
    new BN(feeLockAmount),
    thresholdValue,
    [
      [MGA_ASSET_ID, true],
      [firstCurrency, true],
      //[secondCurrency, true],
    ]
  );
  await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);

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

test("gassless- Given a feeLock correctly configured WHEN the user swaps two tokens defined in the thresholds AND swapValue > threshold THEN the extrinsic is correctly submitted AND No locks AND no fees", async () => {
  await testUser1.addMGATokens(sudo);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    defaultPoolVolumeValue,
    MGA_ASSET_ID,
    defaultPoolVolumeValue
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const sellAssetsValue = thresholdValue.mul(new BN(2));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(firstCurrency, secondCurrency, sellAssetsValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const firstCurrencyBlocked = testUser1
    .getAsset(firstCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(firstCurrency)?.amountBefore.reserved!
    );

  const secondCurrencyBlocked = testUser1
    .getAsset(secondCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(secondCurrency)?.amountBefore.reserved!
    );

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!
    );

  expect(firstCurrencyBlocked).bnEqual(new BN(0));
  expect(secondCurrencyBlocked).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gassless- Given a feeLock correctly configured WHEN the user swaps two tokens defined in the thresholds AND the user has enough MGAs AND swapValue < threshold THEN some MGAs will be locked", async () => {
  await testUser1.addMGATokens(sudo);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    defaultPoolVolumeValue,
    MGA_ASSET_ID,
    defaultPoolVolumeValue
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(firstCurrency, secondCurrency, sellAssetsValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const firstCurrencyBlocked = testUser1
    .getAsset(firstCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(firstCurrency)?.amountBefore.reserved!
    );

  const secondCurrencyBlocked = testUser1
    .getAsset(secondCurrency)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(secondCurrency)?.amountBefore.reserved!
    );

  const userMgaBlocked = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!
    );

  expect(firstCurrencyBlocked).bnEqual(new BN(0));
  expect(secondCurrencyBlocked).bnEqual(new BN(0));
  expect(userMgaBlocked).bnEqual(new BN(feeLockAmount));
});

test("gassless- Given a feeLock correctly configured WHEN the user swaps two tokens that are not defined in the thresholds AND the user has not enough MGAs AND swapValue > threshold THEN the extrinsic can not be submited", async () => {
  const mangata = await getMangataInstance();

  const sellAssetsValue = thresholdValue.mul(new BN(2));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await expect(
    mangata
      .sellAsset(
        testUser1.keyRingPair,
        firstCurrency.toString(),
        secondCurrency.toString(),
        sellAssetsValue,
        new BN(0)
      )
      .catch((reason) => {
        throw new Error(reason.data);
      })
  ).rejects.toThrow(
    "1010: Invalid Transaction: Fee lock processing has failed either due to not enough funds to reserve or an unexpected error"
  );
});
