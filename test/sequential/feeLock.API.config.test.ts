/*
 *
 * @group seqgasless
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  waitSudoOperationSuccess,
  waitSudoOperationFail,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee } from "../../utils/tx";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";
import { getFeeLockMetadata, sleep } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { waitForEvents } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
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

  // setup users
  sudo = getSudoUser();

  [testUser1] = setupUsers();

  await setupApi();

  firstCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, sudo, defaultCurrencyValue),
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        GASP_ASSET_ID,
        defaultPoolVolumeValue,
        firstCurrency,
        defaultPoolVolumeValue,
      ),
    ),
  );
});

test("gasless- GIVEN a non sudo user WHEN feeLock configuration extrinsic is submitted THEN it fails with RequireSudo", async () => {
  await updateFeeLockMetadata(
    testUser1,
    new BN(10),
    new BN(10),
    thresholdValue,
    [[GASP_ASSET_ID, true]],
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
    null,
  );
  await waitSudoOperationFail(updateMetadataEvent, ["InvalidFeeLockMetadata"]);
});

test("gasless- GIVEN a feeLock WHEN periodLength and feeLockAmount are set THEN extrinsic succeed and feeLock is correctly configured", async () => {
  const api = getApi();
  const feeLockData = await getFeeLockMetadata(api);
  const lastPeriodLength = feeLockData.periodLength;
  const lastFeeLockAmount = feeLockData.feeLockAmount;

  const pendingPeriodLength = lastPeriodLength.add(new BN(10));
  const pendingFeeLockAmount = lastFeeLockAmount.add(new BN(10));

  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    pendingPeriodLength,
    pendingFeeLockAmount,
    thresholdValue,
    [[GASP_ASSET_ID, true]],
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  const feeLockDataNow = await getFeeLockMetadata(api);
  const currentPeriodLength = feeLockDataNow.periodLength;
  const currentFeeLockAmount = feeLockDataNow.feeLockAmount;
  expect(currentPeriodLength).bnEqual(pendingPeriodLength);
  expect(currentFeeLockAmount).bnEqual(pendingFeeLockAmount);
});

test("gasless- Changing feeLock config parameter on the fly is works robustly. Either automatic or manual unlocks the tokens", async () => {
  const api = getApi();
  let updateMetadataEvent: any;
  testUser1.addAsset(GASP_ASSET_ID);

  const feeLockAmount = (await getFeeLockMetadata(api)).feeLockAmount;

  updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    new BN(505),
    feeLockAmount,
    thresholdValue,
    [[GASP_ASSET_ID, true]],
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  const saleAssetValue = thresholdValue.sub(new BN(5));
  await testUser1.sellAssets(firstCurrency, GASP_ASSET_ID, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const eventListener = waitForEvents(api, "feeLock.FeeLockUnlocked", 10);
  updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    new BN(5),
    feeLockAmount,
    thresholdValue,
    null,
  );
  await waitSudoOperationSuccess(updateMetadataEvent);
  const tries = 10;
  let unlocked = false;
  for (let index = 0; index < tries && !unlocked; index++) {
    try {
      // eslint-disable-next-line no-loop-func
      await unlockFee(testUser1).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        unlocked = true;
      });
    } catch (ex) {
      await sleep(6000);
    }
  }
  //either we manually unlocked, either automatically, but event should exist.
  await eventListener;
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userMgaLockedValue = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
    );

  const newPeriodLength = new BN(
    JSON.parse(
      JSON.stringify(await api?.query.feeLock.feeLockMetadata()),
    ).periodLength.toString(),
  );

  expect(newPeriodLength).bnEqual(new BN(5));
  expect(userMgaLockedValue).bnEqual(feeLockAmount);
  expect(testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!).bnEqual(
    new BN(0),
  );
});

afterAll(async () => {
  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    new BN(10),
    new BN(10),
    null,
    null,
  );
  await waitSudoOperationSuccess(updateMetadataEvent);
});
