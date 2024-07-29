/*
 *
 * @group paralgasless
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { toBN } from "gasp-sdk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee, sellAsset } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  feeLockErrors,
  getBlockNumber,
  getFeeLockMetadata,
  waitBlockNumber,
  stringToBN,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { addMgaToWhitelisted } from "../../utils/feeLockHelper";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let firstCurrency: BN;
const thresholdValue = new BN(666);
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);

async function checkErrorSellAsset(
  user: User,
  soldAssetId: any,
  boughtAssetId: any,
  reason: string,
  amount = new BN(1000),
) {
  let exception = false;
  const soldAssetIdString = soldAssetId.toString();
  const boughtAssetIdString = boughtAssetId.toString();

  await expect(
    sellAsset(
      user.keyRingPair,
      soldAssetIdString,
      boughtAssetIdString,
      amount,
      new BN(0),
    ).catch((reason) => {
      exception = true;
      throw new Error(reason.data);
    }),
  ).rejects.toThrow(reason);

  expect(exception).toBeTruthy();
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  // setup users
  sudo = getSudoUser();

  firstCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo,
  );

  await sudo.createPoolToAsset(
    defaultPoolVolumeValue,
    defaultPoolVolumeValue,
    MGA_ASSET_ID,
    firstCurrency,
  );

  await addMgaToWhitelisted(thresholdValue, sudo);
});

beforeEach(async () => {
  await setupApi();

  [testUser1] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintToken(firstCurrency, testUser1, new BN(100000)),
  );
});

test("gasless- GIVEN a feeLock configured WHEN a swap happens THEN fees are not charged but locked instead", async () => {
  const api = getApi();

  testUser1.addAsset(MGA_ASSET_ID);

  const { feeLockAmount } = await getFeeLockMetadata(api);
  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [MGA_ASSET_ID.toString(), firstCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeFalsy();
  await testUser1.sellAssets(MGA_ASSET_ID, firstCurrency, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const tokenFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!,
    );

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
    )
    .add(new BN(feeLockAmount))
    .add(new BN(saleAssetValue));

  expect(tokenFees).bnEqual(new BN(feeLockAmount));
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gasless- GIVEN a correct config for gasless swaps WHEN the user runs unlock-fee THEN fees are not charged for token unlockFee", async () => {
  const api = getApi();

  testUser1.addAsset(MGA_ASSET_ID);

  const saleAssetValue = thresholdValue.sub(new BN(5));
  const { periodLength } = await getFeeLockMetadata(api);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(MGA_ASSET_ID, firstCurrency, saleAssetValue);
  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(testUser1.keyRingPair.address),
    ),
  );
  const waitingBlock = stringToBN(accountFeeLockData.lastFeeLockBlock).add(
    periodLength,
  );
  await waitBlockNumber(waitingBlock.toString(), periodLength.toNumber() + 5);
  try {
    await unlockFee(testUser1);
  } catch (error) {
    //this will be either unlock or automatically unlock will do it
  }

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
    )
    .add(new BN(saleAssetValue));

  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!).bnEqual(
    new BN(0),
  );
  expect(userMgaFees).bnEqual(new BN(0));
});

test("gasless- High-value swaps are rejected from the txn pool if they would fail before the percentage fee is charged", async () => {
  await checkErrorSellAsset(
    testUser1,
    MGA_ASSET_ID,
    firstCurrency,
    feeLockErrors.SwapApprovalFail,
    toBN("1", 26),
  );
});

test("gasless- For low-value swaps, token reservation status and pallet storage are altered in accordance with the timeout mechanism", async () => {
  async function checkAccountFeeLockData(
    totalAmountValue: any,
    lastBlockValue: any,
  ) {
    const api = getApi();
    const accountFeeLockData = JSON.parse(
      JSON.stringify(
        await api.query.feeLock.accountFeeLockData(
          testUser1.keyRingPair.address,
        ),
      ),
    );
    expect(stringToBN(accountFeeLockData.totalFeeLockAmount)).bnEqual(
      new BN(totalAmountValue),
    );
    expect(stringToBN(accountFeeLockData.lastFeeLockBlock)).bnEqual(
      new BN(lastBlockValue),
    );
  }

  const api = getApi();

  await addMgaToWhitelisted(thresholdValue, sudo);

  const { feeLockAmount, periodLength } = await getFeeLockMetadata(api);

  testUser1.addAsset(MGA_ASSET_ID);
  await checkAccountFeeLockData(0, 0);

  const saleAssetValue = thresholdValue.sub(new BN(5));

  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [MGA_ASSET_ID.toString(), firstCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeFalsy();

  await testUser1.sellAssets(MGA_ASSET_ID, firstCurrency, saleAssetValue);
  const lockDataBlockNumber = await getBlockNumber();

  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(testUser1.keyRingPair.address),
    ),
  );
  const waitingBlock = stringToBN(accountFeeLockData.lastFeeLockBlock).add(
    periodLength,
  );
  await checkAccountFeeLockData(feeLockAmount, lockDataBlockNumber);
  await waitBlockNumber(waitingBlock.toString(), periodLength.toNumber() + 5);
  try {
    await unlockFee(testUser1);
  } catch (error) {
    //this will be either unlock or automatically unlock will do it
  }
  await checkAccountFeeLockData(0, 0);
});

test("gasless- High-value swaps when successful are not charged txn fee or token locked, but the percentage fee is charged", async () => {
  const secondCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(secondCurrency, sudo, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue,
      ),
    ),
  );

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);

  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    null,
    null,
    thresholdValue,
    [[firstCurrency, true]],
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  const saleAssetValue = thresholdValue.add(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeTruthy();
  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userMgaFees = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
    );

  expect(userMgaFees).bnEqual(new BN(0));
  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!).bnEqual(
    new BN(0),
  );
});
