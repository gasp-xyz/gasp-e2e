/*
 *
 * @group paralgasless
 * @group parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  waitNewBlock,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { BN_ZERO } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee, sellAsset } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
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

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await sudo.createPoolToAsset(
    defaultPoolVolumeValue,
    defaultPoolVolumeValue,
    firstCurrency,
    secondCurrency
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
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await setupApi();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue)
  );

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);
});

test("gasless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period did not finished THEN the operation can not be submitted", async () => {
  const feeLockAmount = await (await getFeeLockMetadata()).feeLockAmount;
  await testUser1.addMGATokens(sudo, feeLockAmount);

  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  await expect(
    sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      saleAssetValue,
      new BN(0)
    ).catch((reason) => {
      throw new Error(reason.data);
    })
  ).rejects.toThrow(feeLockErrors.FeeLockingFail);
});

test("gasless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period finished THEN the operation can be submitted ( unlock before locking )", async () => {
  const api = getApi();

  const { feeLockAmount, periodLength } = await getFeeLockMetadata();

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(testUser1.keyRingPair.address)
    )
  );
  const waitingBlock = accountFeeLockData.lastFeeLockBlock + periodLength;
  await waitBlockNumber(waitingBlock, periodLength.toNumber() + 5);

  await testUser1
    .sellAssets(firstCurrency, secondCurrency, saleAssetValue)
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
});

test("gasless- GIVEN some locked tokens WHEN querying accountFeeLockData THEN the amount matches with locked tokens AND lastFeeLockBlock matches with the block when tokens were locked", async () => {
  const api = getApi();

  const { feeLockAmount } = await getFeeLockMetadata();

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  const block = await getBlockNumber();

  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(testUser1.keyRingPair.address)
    )
  );

  expect(stringToBN(accountFeeLockData.lastFeeLockBlock)).bnEqual(
    new BN(block)
  );
  expect(stringToBN(accountFeeLockData.totalFeeLockAmount)).bnEqual(
    new BN(feeLockAmount)
  );
});

test("gasless- GIVEN some locked tokens and lastFeeLockBlock is lower than current block WHEN release feeLock is requested THEN the tokens are unlocked", async () => {
  const api = getApi();

  const { feeLockAmount, periodLength } = await getFeeLockMetadata();

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));
  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(testUser1.keyRingPair.address)
    )
  );

  const waitingBlock = accountFeeLockData.lastFeeLockBlock + periodLength;
  await waitBlockNumber(waitingBlock, periodLength.toNumber() + 5);

  try {
    await unlockFee(testUser1);
  } catch (error) {
    //this could fail because automatic unlock, but either this get unlocked or automatically unlocked.
  }

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!).bnEqual(
    new BN(feeLockAmount)
  );
  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!).bnEqual(
    new BN(0)
  );
});

test("gasless- GIVEN a lock WHEN the period is N THEN the tokens can not be unlocked before that period", async () => {
  const api = getApi();
  let currentBlockNumber: number;

  const { feeLockAmount, periodLength } = await getFeeLockMetadata();
  await testUser1.addMGATokens(sudo, new BN(feeLockAmount));

  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);
  const feeLockBlock = stringToBN(
    JSON.parse(
      JSON.stringify(
        await api.query.feeLock.accountFeeLockData(
          testUser1.keyRingPair.address
        )
      )
    ).lastFeeLockBlock
  );
  const waitingBlock = feeLockBlock.add(periodLength);

  currentBlockNumber = await getBlockNumber();

  do {
    await expect(
      unlockFee(testUser1).catch((reason) => {
        throw new Error(reason.data);
      })
    ).rejects.toThrow(feeLockErrors.FeeUnlockingFail);
    await waitNewBlock();
    currentBlockNumber = await getBlockNumber();
    testLog
      .getLog()
      .info(
        "now::" +
          currentBlockNumber +
          "Waiting for block " +
          waitingBlock.toString()
      );
  } while (currentBlockNumber < waitingBlock.subn(2).toNumber());
  // at this point, we should be able to unlock in the following 3-4 blocks
  let succeeded = false;
  for (let index = 0; index < 3 && !succeeded; index++) {
    try {
      const result = await unlockFee(testUser1);
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      succeeded = true;
    } catch (e) {
      await waitNewBlock();
    }
  }
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const reserved = testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved;
  expect(reserved).bnEqual(BN_ZERO);
  //expect(succeeded).toBeTruthy();
});
