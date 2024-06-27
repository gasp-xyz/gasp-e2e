/*
 *
 * @group paralgasless
 * @group parallel
 */
import { jest } from "@jest/globals";
import { ApiPromise } from "@polkadot/api";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  waitNewBlock,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { BN_ZERO } from "@mangata-finance/sdk";
import {
  Extrinsic,
  getSudoUser,
  setupApi,
  setupUsers,
} from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee, sellAsset } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  getBlockNumber,
  waitBlockNumber,
  feeLockErrors,
  getFeeLockMetadata,
  stringToBN,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { testLog } from "../../utils/Logger";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUsers: User[];
let sudo: User;
let firstCurrency: BN;
let secondCurrency: BN;
let feeLockAmount: BN;
let periodLength: BN;
let api: ApiPromise;

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

  await setupApi();
  api = getApi();

  // setup users
  sudo = getSudoUser();

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await sudo.createPoolToAsset(
    defaultPoolVolumeValue,
    defaultPoolVolumeValue,
    firstCurrency,
    secondCurrency,
  );

  const updateMetadataEvent = await updateFeeLockMetadata(
    sudo,
    null,
    null,
    thresholdValue,
    [
      [GASP_ASSET_ID, true],
      [firstCurrency, true],
    ],
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  const feeMetadata = await getFeeLockMetadata(api);

  feeLockAmount = feeMetadata.feeLockAmount;
  periodLength = feeMetadata.periodLength;

  testUsers = setupUsers();

  const txs: Extrinsic[] = [];

  testUsers.forEach((user: User) => {
    txs.push(Assets.mintToken(firstCurrency, user, defaultCurrencyValue));
    txs.push(Assets.mintToken(secondCurrency, user, defaultCurrencyValue));
    user.addAsset(GASP_ASSET_ID);
  });

  await Sudo.batchAsSudoFinalized(...txs);
});

test("gasless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period did not finished THEN the operation can not be submitted", async () => {
  await testUsers[0].addGASPTokens(sudo, feeLockAmount);

  const saleAssetValue = thresholdValue.sub(new BN(5));
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeFalsy();
  await testUsers[0].sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  await expect(
    sellAsset(
      testUsers[0].keyRingPair,
      firstCurrency,
      secondCurrency,
      saleAssetValue,
      new BN(0),
    ).catch((reason) => {
      throw new Error(reason.data);
    }),
  ).rejects.toThrow(feeLockErrors.FeeLockingFail);
});

test("gasless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period finished THEN the operation can be submitted ( unlock before locking )", async () => {
  await testUsers[1].addGASPTokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeFalsy();
  await testUsers[1].sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(
        testUsers[1].keyRingPair.address,
      ),
    ),
  );
  const waitingBlock = stringToBN(accountFeeLockData.lastFeeLockBlock).add(
    periodLength,
  );
  await waitBlockNumber(waitingBlock.toString(), periodLength.toNumber() + 5);

  await testUsers[1]
    .sellAssets(firstCurrency, secondCurrency, saleAssetValue)
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
});

test("gasless- GIVEN some locked tokens WHEN querying accountFeeLockData THEN the amount matches with locked tokens AND lastFeeLockBlock matches with the block when tokens were locked", async () => {
  await testUsers[2].addGASPTokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeFalsy();
  await testUsers[2].sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  const block = await getBlockNumber();

  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(
        testUsers[2].keyRingPair.address,
      ),
    ),
  );

  expect(stringToBN(accountFeeLockData.lastFeeLockBlock)).bnEqual(
    new BN(block),
  );
  expect(stringToBN(accountFeeLockData.totalFeeLockAmount)).bnEqual(
    new BN(feeLockAmount),
  );
});

test("gasless- GIVEN some locked tokens and lastFeeLockBlock is lower than current block WHEN release feeLock is requested THEN the tokens are unlocked", async () => {
  await testUsers[3].addGASPTokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeFalsy();
  await testUsers[3].sellAssets(firstCurrency, secondCurrency, saleAssetValue);
  await testUsers[3].refreshAmounts(AssetWallet.BEFORE);
  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(
        testUsers[3].keyRingPair.address,
      ),
    ),
  );

  const waitingBlock = stringToBN(accountFeeLockData.lastFeeLockBlock).add(
    periodLength,
  );
  await waitBlockNumber(waitingBlock.toString(), periodLength.toNumber() + 5);

  try {
    await unlockFee(testUsers[3]);
  } catch (error) {
    //this could fail because automatic unlock, but either this get unlocked or automatically unlocked.
  }

  await testUsers[3].refreshAmounts(AssetWallet.AFTER);
  expect(testUsers[3].getAsset(GASP_ASSET_ID)?.amountBefore.reserved!).bnEqual(
    new BN(feeLockAmount),
  );
  expect(testUsers[3].getAsset(GASP_ASSET_ID)?.amountAfter.reserved!).bnEqual(
    new BN(0),
  );
});

test("gasless- GIVEN a lock WHEN the period is N THEN the tokens can not be unlocked before that period", async () => {
  let currentBlockNumber: number;

  await testUsers[4].addGASPTokens(sudo, new BN(feeLockAmount));

  const saleAssetValue = thresholdValue.sub(new BN(5));
  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeFalsy();
  await testUsers[4].sellAssets(firstCurrency, secondCurrency, saleAssetValue);
  const feeLockBlock = stringToBN(
    JSON.parse(
      JSON.stringify(
        await api.query.feeLock.accountFeeLockData(
          testUsers[4].keyRingPair.address,
        ),
      ),
    ).lastFeeLockBlock,
  );
  const waitingBlock = feeLockBlock.add(periodLength);

  currentBlockNumber = await getBlockNumber();

  do {
    await expect(
      unlockFee(testUsers[4]).catch((reason) => {
        throw new Error(reason.data);
      }),
    ).rejects.toThrow(feeLockErrors.FeeUnlockingFail);
    await waitNewBlock();
    currentBlockNumber = await getBlockNumber();
    testLog
      .getLog()
      .info(
        "now::" +
          currentBlockNumber +
          "Waiting for block " +
          waitingBlock.toString(),
      );
  } while (currentBlockNumber < waitingBlock.subn(2).toNumber());
  // at this point, we should be able to unlock in the following 3-4 blocks
  let succeeded = false;
  for (let index = 0; index < 3 && !succeeded; index++) {
    try {
      const result = await unlockFee(testUsers[4]);
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      succeeded = true;
    } catch (e) {
      await waitNewBlock();
    }
  }
  await testUsers[4].refreshAmounts(AssetWallet.AFTER);
  const reserved = testUsers[4].getAsset(GASP_ASSET_ID)?.amountAfter.reserved;
  expect(reserved).bnEqual(BN_ZERO);
  //expect(succeeded).toBeTruthy();
});
