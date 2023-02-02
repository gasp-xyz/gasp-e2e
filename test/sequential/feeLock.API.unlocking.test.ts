/*
 *
 * @group sequential
 * @group gassless
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { waitSudoOperataionSuccess } from "../../utils/eventListeners";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata, unlockFee } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForNBlocks,
  getBlockNumber,
  waitBlockNumber,
  feeLockErrors,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

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

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await setupApi();

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
  await waitSudoOperataionSuccess(updateMetadataEvent);

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);
});

test("gassless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period did not finished THEN the operation can not be submitted", async () => {
  const api = getApi();

  const feeLockAmount = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  ).feeLockAmount;

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount));

  const mangata = await getMangataInstance();
  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);

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

test("gassless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period finished THEN the operation can be submitted ( unlock before locking )", async () => {
  const api = getApi();

  const feeLockAmount = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  ).feeLockAmount;
  const periodLength = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  ).periodLength;

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  await waitForNBlocks(periodLength);

  await testUser1
    .sellAssets(firstCurrency, secondCurrency, saleAssetValue)
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
});

test("gassless- GIVEN some locked tokens WHEN querying accountfeeLockData THEN the amount matches with locked tokens AND lastFeeLockBlock matches with the block when tokens were locked", async () => {
  const api = getApi();

  const feeLockAmount = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  ).feeLockAmount;

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  const block = await getBlockNumber();

  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(testUser1.keyRingPair.address)
    )
  );

  expect(new BN(accountFeeLockData.lastFeeLockBlock)).bnEqual(new BN(block));
  expect(new BN(accountFeeLockData.totalFeeLockAmount)).bnEqual(
    new BN(feeLockAmount)
  );
});

test("gassless- GIVEN some locked tokens and lastFeeLockblock is lower than current block WHEN release feeLock is requested THEN the tokens are unlocked", async () => {
  const api = getApi();

  const feeLockAmount = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  ).feeLockAmount;
  const periodLength = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  ).periodLength;

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const saleAssetValue = thresholdValue.sub(new BN(5));
  await testUser1.sellAssets(firstCurrency, secondCurrency, saleAssetValue);

  const accountFeeLockData = JSON.parse(
    JSON.stringify(
      await api.query.feeLock.accountFeeLockData(testUser1.keyRingPair.address)
    )
  );

  const waitingBlock = accountFeeLockData.lastFeeLockBlock + periodLength;
  await waitBlockNumber(waitingBlock, periodLength + 5);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await unlockFee(testUser1);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!).bnEqual(
    new BN(feeLockAmount)
  );
  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!).bnEqual(
    new BN(0)
  );
});
