/*
 *
 * @group paralgasless
 * @group parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { BN_ZERO } from "@mangata-finance/sdk";

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

  [secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await setupApi();

  [firstCurrency] = await Assets.setupUserWithCurrencies(
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

test.only("gasless- isFree depends on the token and the sell valuation", async () => {
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

  const saleAssetValue = thresholdValue.add(new BN(2));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toNumber(), secondCurrency.toNumber()],
    saleAssetValue
  );
  expect(isFree).toBeTruthy();

  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [firstCurrency.toNumber(), secondCurrency.toNumber()],
      thresholdValue.subn(2)
    )
  ).toBeFalsy();
  const amount = await mangata?.rpc.calculateSellPriceId(
    secondCurrency.toString(),
    firstCurrency.toString(),
    thresholdValue.subn(2)
  );
  const th = thresholdValue.sub(amount!).lte(BN_ZERO)
    ? thresholdValue
    : amount?.add(thresholdValue.sub(amount!))!;
  //this is false because the token is not whitelisted & there is no direct conversion to mgx.
  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [secondCurrency.toNumber(), firstCurrency.toNumber()],
      th.addn(2)
    )
  ).toBeFalsy();

  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [firstCurrency.toNumber(), secondCurrency.toNumber()],
      th.subn(2)
    )
  ).toBeFalsy();
  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [firstCurrency.toNumber(), secondCurrency.toNumber()],
      th.addn(2)
    )
  ).toBeTruthy();
});
