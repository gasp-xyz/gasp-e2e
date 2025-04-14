/*
 *
 * @group paralgasless
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { BN, BN_ZERO } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  calculate_sell_price_id_rpc,
  multiSwapSellMarket,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { User } from "../../utils/User";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Market } from "../../utils/market";
import { rpcCalculateBuyPrice } from "../../utils/feeLockHelper";
import { FeeLock } from "../../utils/FeeLock";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let firstCurrency: BN;
let secondCurrency: BN;
let thirdCurrency: BN;

const thresholdValue = new BN(666).mul(Assets.MG_UNIT);
const defaultCurrencyValue = new BN(10000000).mul(Assets.MG_UNIT);
const defaultPoolVolumeValue = new BN(1000000).mul(Assets.MG_UNIT);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();
  await setupApi();
  [secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );
  [testUser1] = setupUsers();

  await setupApi();

  [firstCurrency, thirdCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
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
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(thirdCurrency, testUser1, defaultCurrencyValue),
    Sudo.sudo(FeeLock.updateTokenValueThreshold(firstCurrency, thresholdValue)),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue,
      ),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        thirdCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue,
      ),
    ),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        GASP_ASSET_ID,
        defaultPoolVolumeValue,
      ),
    ),
  );

  testUser1.addAsset(GASP_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);
  testUser1.addAsset(thirdCurrency);
});

test("gasless- isFree depends on the token and the sell valuation AND prevalidation th", async () => {
  const saleAssetValue = thresholdValue.add(new BN(2));
  // non mga paired token. -> always false.
  expect(
    (
      await Market.isBuyAssetLockFree(
        [secondCurrency.toString(), thirdCurrency.toString()],
        thresholdValue!.addn(1000),
      )
    ).toString(),
  ).toEqual("false");

  const isFree = Market.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeTruthy();
  //MGA pool
  expect(
    (
      await Market.isSellAssetLockFree(
        [firstCurrency.toString(), GASP_ASSET_ID.toString()],
        thresholdValue.subn(2),
      )
    ).toString(),
  ).toEqual("false");
  expect(
    (
      await Market.isSellAssetLockFree(
        [GASP_ASSET_ID.toString(), firstCurrency.toString()],
        thresholdValue.subn(2),
      )
    ).toString(),
  ).toEqual("false");
  expect(
    (
      await Market.isSellAssetLockFree(
        [GASP_ASSET_ID.toString(), firstCurrency.toString()],
        thresholdValue,
      )
    ).toString(),
  ).toEqual("true");
  expect(
    (
      await Market.isSellAssetLockFree(
        [firstCurrency.toString(), GASP_ASSET_ID.toString()],
        thresholdValue,
      )
    ).toString(),
  ).toEqual("true");

  //MGA paired token
  expect(
    (
      await Market.isSellAssetLockFree(
        [firstCurrency.toString(), secondCurrency.toString()],
        thresholdValue.subn(2),
      )
    ).toString(),
  ).toEqual("false");
  const amount = (await rpcCalculateBuyPrice(
    secondCurrency,
    firstCurrency,
    thresholdValue,
  ))!;
  //this is false because the token is not whitelisted & there is no direct conversion to mgx.
  //and the valuation of the result is less than threshold. ( you need 670secCurr to get 666firstCurr)
  //th is 670,
  expect(
    (
      await Market.isSellAssetLockFree(
        [secondCurrency.toString(), firstCurrency.toString()],
        thresholdValue.addn(2),
      )
    ).toString(),
  ).toEqual("false");

  expect(
    (
      await Market.isSellAssetLockFree(
        [secondCurrency.toString(), firstCurrency.toString()],
        amount.addn(1),
      )
    ).toString(),
  ).toEqual("true");

  expect(
    (
      await Market.isSellAssetLockFree(
        [firstCurrency.toString(), secondCurrency.toString()],
        thresholdValue.subn(1),
      )
    ).toString(),
  ).toEqual("false");
  expect(
    (
      await Market.isSellAssetLockFree(
        [firstCurrency.toString(), secondCurrency.toString()],
        amount.addn(1),
      )
    ).toString(),
  ).toEqual("true");

  //Indirect paired token
  const amountReqToGetThreshold = await calculate_sell_price_id_rpc(
    firstCurrency,
    secondCurrency,
    thresholdValue.subn(1),
  );
  //Same as before, we first calcualte from wich value, the buy results on the threshold.
  //Then we check that the value (-1) result in false, and +1 in true.
  expect(
    (
      await Market.isBuyAssetLockFree(
        [secondCurrency.toString(), firstCurrency.toString()],
        amountReqToGetThreshold!,
      )
    ).toString(),
  ).toEqual("false");
  expect(
    (
      await Market.isBuyAssetLockFree(
        [secondCurrency.toString(), firstCurrency.toString()],
        amountReqToGetThreshold!.addn(1),
      )
    ).toString(),
  ).toEqual("true");
});

test("gasless- isFree works same as multiswap of two", async () => {
  const saleAssetValue = thresholdValue
    .add(new BN(2))
    .add(thresholdValue.muln(0.004));

  const isFree = await Market.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );

  const mgasBef = await mangata?.query.getTokenBalance(
    GASP_ASSET_ID.toString(),
    testUser1.keyRingPair.address,
  );

  const events = await multiSwapSellMarket(
    testUser1,
    [firstCurrency, secondCurrency],
    saleAssetValue,
    new BN("663").mul(Assets.MG_UNIT),
  );

  const eventResponse = getEventResultFromMangataTx(events!, [
    "xyk",
    "AssetsSwapped",
  ]);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const mgasAfter = await mangata?.query.getTokenBalance(
    GASP_ASSET_ID.toString(),
    testUser1.keyRingPair.address,
  );
  expect(mgasBef?.reserved).bnEqual(BN_ZERO);
  expect(mgasAfter?.reserved).bnEqual(BN_ZERO);
  expect(mgasBef!.free).bnEqual(mgasAfter!.free);
  expect(isFree.toString()).toEqual("true");
});
