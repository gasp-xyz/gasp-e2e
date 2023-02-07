/*
 *
 * @group sequential
 * @group seqgassless
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  waitSudoOperationSuccess,
  waitSudoOperationFail,
} from "../../utils/eventListeners";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee } from "../../utils/tx";
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
let firstCurrency: BN;
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

  [testUser1] = setupUsers();

  await setupApi();

  firstCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, sudo, defaultCurrencyValue),
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultPoolVolumeValue,
        firstCurrency,
        defaultPoolVolumeValue
      )
    )
  );
});

test("gasless- GIVEN a non sudo user WHEN feeLock configuration extrinsic is submitted THEN it fails with RequireSudo", async () => {
  await updateFeeLockMetadata(
    testUser1,
    new BN(10),
    new BN(10),
    thresholdValue,
    [[MGA_ASSET_ID, true]]
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toContain("RequireSudo");
  });
});

test("gasless- GIVEN an empty feeLock configuration (all options empty) WHEN sudo submit the extrinsic THEN Tx fails because insufficient params", async () => {
  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    new BN(0),
    new BN(0),
    new BN(0),
    null
  );
  await waitSudoOperationFail(updateMetadataEvent, "InvalidFeeLockMetadata");
});

test("gasless- GIVEN a feeLock WHEN periodLength and feeLockAmount are set THEN extrinsic succeed and feeLock is correctly configured", async () => {
  const api = getApi();

  const lastPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).periodLength.toString()
  );
  const lastFeeLockAmount = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).feeLockAmount.toString()
  );

  const pendingPeriodLength = lastPeriodLength.add(new BN(10));
  const pendingFeeLockAmount = lastFeeLockAmount.add(new BN(10));

  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    pendingPeriodLength,
    pendingFeeLockAmount,
    thresholdValue,
    [[MGA_ASSET_ID, true]]
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  const currentPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).periodLength.toString()
  );
  const currentFeeLockAmount = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).feeLockAmount.toString()
  );

  expect(currentPeriodLength).bnEqual(pendingPeriodLength);
  expect(currentFeeLockAmount).bnEqual(pendingFeeLockAmount);
});

test("gasless- Changing feeLock config parameter on the fly is works robustly", async () => {
  const api = getApi();
  let updateMetadataEvent: any;
  testUser1.addAsset(MGA_ASSET_ID);

  const feeLockAmount = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).feeLockAmount.toString()
  );

  updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    new BN(505),
    feeLockAmount,
    thresholdValue,
    [[MGA_ASSET_ID, true]]
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  const saleAssetValue = thresholdValue.sub(new BN(5));
  await testUser1.sellAssets(firstCurrency, MGA_ASSET_ID, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    new BN(2),
    feeLockAmount,
    thresholdValue,
    null
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  await waitForNBlocks(2);
  await unlockFee(testUser1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userMgaLockedValue = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!
    );

  const newPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata())
    ).periodLength.toString()
  );

  expect(newPeriodLength).bnEqual(new BN(2));
  expect(userMgaLockedValue).bnEqual(new BN(feeLockAmount));
  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!).bnEqual(
    new BN(0)
  );
});

afterAll(async () => {
  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    new BN(10),
    new BN(10),
    null,
    null
  );
  await waitSudoOperationSuccess(updateMetadataEvent);
});
