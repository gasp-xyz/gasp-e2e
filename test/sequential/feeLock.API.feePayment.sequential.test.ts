/*
 *
 * @group seqgasless
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID, TUR_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { feeLockErrors } from "../../utils/utils";
import { clearMgaFromWhitelisted } from "../../utils/feeLockHelper";
import { sellAsset } from "../../utils/tx";
import { Market } from "../../utils/market";

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
  amount: BN,
  reason: string,
) {
  let exception = false;

  await expect(
    sellAsset(
      user.keyRingPair,
      soldAssetId,
      boughtAssetId,
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
});

beforeEach(async () => {
  await setupApi();

  [testUser1] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        GASP_ASSET_ID,
        defaultPoolVolumeValue,
        firstCurrency,
        defaultPoolVolumeValue,
      ),
    ),
  );
});

test("gasless- GIVEN a feeLock configured (only Time and Amount ) WHEN the user swaps AND the user has not enough MGAs and has enough TURs THEN the extrinsic fails on submission", async () => {
  await clearMgaFromWhitelisted(thresholdValue, sudo);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, new BN(2)),
    Assets.mintToken(TUR_ASSET_ID, testUser1),
  );

  await checkErrorSellAsset(
    testUser1,
    firstCurrency,
    GASP_ASSET_ID,
    thresholdValue.sub(new BN(100)),
    feeLockErrors.FeeLockingFail,
  );
});

test("gasless- GIVEN a feeLock configured (only Time and Amount )  WHEN the user swaps AND the user does not have enough MGAs THEN the extrinsic fails on submission", async () => {
  await clearMgaFromWhitelisted(thresholdValue, sudo);

  await testUser1.addGASPTokens(sudo, new BN(2));

  await checkErrorSellAsset(
    testUser1,
    firstCurrency,
    GASP_ASSET_ID,
    thresholdValue.sub(new BN(100)),
    feeLockErrors.FeeLockingFail,
  );
});

test("gasless- Given a feeLock correctly configured (only Time and Amount ) WHEN the user swaps AND the user has enough MGAs THEN the extrinsic is correctly submitted", async () => {
  await clearMgaFromWhitelisted(thresholdValue, sudo);

  await testUser1.addGASPTokens(sudo);
  testUser1.addAsset(GASP_ASSET_ID);
  testUser1.addAsset(firstCurrency);

  const saleAssetValue = thresholdValue.add(new BN(5));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.sellAssets(GASP_ASSET_ID, firstCurrency, saleAssetValue);
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const firstCurrencyDeposit = testUser1
    .getAsset(firstCurrency)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(firstCurrency)?.amountBefore.free!,
    );

  const tokenFees = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.reserved!,
    );

  const userMgaFees = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free!,
    )
    .add(new BN(saleAssetValue));

  expect(firstCurrencyDeposit).bnGt(new BN(0));
  expect(tokenFees).bnEqual(new BN(0));
  expect(userMgaFees).bnEqual(new BN(0));
});
