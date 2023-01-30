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

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );
});

beforeEach(async () => {
  const api = getApi();

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

  feeLockMetadata = JSON.parse(
    JSON.stringify(await api.query.feeLock.feeLockMetadata())
  );

  periodLength = feeLockMetadata.periodLength;
  feeLockAmount = feeLockMetadata.feeLockAmount;

  if (periodLength > 20) {
    await updateFeeLockMetadata(
      sudo,
      new BN(10),
      new BN(feeLockAmount),
      null,
      null
    );

    feeLockMetadata = JSON.parse(
      JSON.stringify(await api.query.feeLock.feeLockMetadata())
    );

    periodLength = feeLockMetadata.periodLength;
  }

  const updateMgaTimeoutMetadata = await updateFeeLockMetadata(
    sudo,
    new BN(periodLength),
    new BN(feeLockAmount),
    thresholdValue,
    [
      [MGA_ASSET_ID, true],
      [firstCurrency, true],
    ]
  );
  await waitSudoOperataionSuccess(updateMgaTimeoutMetadata);

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);
});

test("gassless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period did not finished THEN the operation can not be submitted", async () => {
  await testUser1.addMGATokens(sudo, new BN(feeLockAmount));

  const mangata = await getMangataInstance();
  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, sellAssetsValue);

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

test("gassless- GIVEN some locked tokens and no more free MGX WHEN another tx is submitted AND lock period finished THEN the operation can be submitted ( unlock before locking )", async () => {
  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, sellAssetsValue);

  await waitForNBlocks(periodLength);

  await testUser1
    .sellAssets(firstCurrency, secondCurrency, sellAssetsValue)
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
});

test("gassless- GIVEN some locked tokens WHEN querying a count feeLock Data THEN the amount matches with locked tokens AND lastTimeoutBlock matches with the block when tokens were locked", async () => {
  const api = getApi();

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const sellAssetsValue = thresholdValue.sub(new BN(5));

  await testUser1.sellAssets(firstCurrency, secondCurrency, sellAssetsValue);

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

test("gassless- GIVEN some locked tokens and lastTimeoutblock is lower than current block WHEN release timeout is requested THEN the tokens are unlocked ( the storage remove those tokens AND tokens are now free )", async () => {
  const api = getApi();

  await testUser1.addMGATokens(sudo, new BN(feeLockAmount).add(new BN(1)));

  const sellAssetsValue = thresholdValue.sub(new BN(5));
  await testUser1.sellAssets(firstCurrency, secondCurrency, sellAssetsValue);

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

  const userMgaLockedBefore =
    testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.reserved!;
  const userMgaLockedAfter =
    testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.reserved!;

  expect(userMgaLockedBefore).bnEqual(new BN(feeLockAmount));
  expect(userMgaLockedAfter).bnEqual(new BN(0));
});
