/*
 *
 * @group paralgasless
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  ExtrinsicResult,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { BN, BN_ONE, BN_ZERO } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { updateFeeLockMetadata } from "../../utils/tx";
import { User } from "../../utils/User";
import { Xyk } from "../../utils/xyk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

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
      [MGA_ASSET_ID, true],
      [firstCurrency, true],
    ],
  );
  await waitSudoOperationSuccess(updateMetadataEvent);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(thirdCurrency, testUser1, defaultCurrencyValue),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue,
      ),
    ),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        thirdCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue,
      ),
    ),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        MGA_ASSET_ID,
        defaultPoolVolumeValue,
      ),
    ),
  );

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(firstCurrency);
  testUser1.addAsset(secondCurrency);
  testUser1.addAsset(thirdCurrency);
});

test("gasless- isFree depends on the token and the sell valuation", async () => {
  const saleAssetValue = thresholdValue.add(new BN(2));
  //non existing pool
  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [secondCurrency.toString(), firstCurrency.addn(10).toString()],
      thresholdValue!.addn(1),
    ),
  ).toBeFalsy();
  // non mga paired token. -> always false.
  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [secondCurrency.toString(), thirdCurrency.toString()],
      thresholdValue!.addn(1000),
    ),
  ).toBeFalsy();

  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeTruthy();
  //MGA pool
  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [firstCurrency.toString(), MGA_ASSET_ID.toString()],
      thresholdValue.subn(2),
    ),
  ).toBeFalsy();
  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [MGA_ASSET_ID.toString(), firstCurrency.toString()],
      thresholdValue.subn(2),
    ),
  ).toBeFalsy();
  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [MGA_ASSET_ID.toString(), firstCurrency.toString()],
      thresholdValue,
    ),
  ).toBeTruthy();
  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [firstCurrency.toString(), MGA_ASSET_ID.toString()],
      thresholdValue,
    ),
  ).toBeTruthy();

  //MGA paired token
  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [firstCurrency.toString(), secondCurrency.toString()],
      thresholdValue.subn(2),
    ),
  ).toBeFalsy();
  const amount = (await mangata?.rpc.calculateBuyPriceId(
    secondCurrency.toString(),
    firstCurrency.toString(),
    thresholdValue,
  ))!;
  //this is false because the token is not whitelisted & there is no direct conversion to mgx.
  //and the valuation of the result is less than threshold. ( you need 670secCurr to get 666firstCurr)
  //th is 670,
  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [secondCurrency.toString(), firstCurrency.toString()],
      thresholdValue.addn(2),
    ),
  ).toBeFalsy();

  expect(
    await mangata?.rpc.isSellAssetLockFree(
      [secondCurrency.toString(), firstCurrency.toString()],
      amount.addn(1),
    ),
  ).toBeTruthy();

  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [firstCurrency.toString(), secondCurrency.toString()],
      thresholdValue.subn(1),
    ),
  ).toBeFalsy();
  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [firstCurrency.toString(), secondCurrency.toString()],
      amount.addn(1),
    ),
  ).toBeTruthy();

  //Indirect paired token
  const amountReqToGetThreshold = await mangata?.rpc.calculateSellPriceId(
    firstCurrency.toString(),
    secondCurrency.toString(),
    thresholdValue.subn(1),
  );
  //Same as before, we first calcualte from wich value, the buy results on the threshold.
  //Then we check that the value (-1) result in false, and +1 in true.
  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [secondCurrency.toString(), firstCurrency.toString()],
      amountReqToGetThreshold!,
    ),
  ).toBeFalsy();
  expect(
    await mangata?.rpc.isBuyAssetLockFree(
      [secondCurrency.toString(), firstCurrency.toString()],
      amountReqToGetThreshold!.addn(1),
    ),
  ).toBeTruthy();
});

test("gasless- isFree works same as multiswap of two", async () => {
  const saleAssetValue = thresholdValue.add(new BN(2));

  const isFree = await mangata?.rpc.isSellAssetLockFree(
    [firstCurrency.toString(), secondCurrency.toString()],
    saleAssetValue,
  );
  expect(isFree).toBeTruthy();
  const mgasBef = await mangata?.query.getTokenBalance(
    MGA_ASSET_ID.toString(),
    testUser1.keyRingPair.address,
  );
  const events = await mangata?.xyk.multiswapSellAsset({
    account: testUser1.keyRingPair,
    amount: saleAssetValue,
    minAmountOut: BN_ONE,
    tokenIds: [firstCurrency.toString(), secondCurrency.toString()],
  });
  const eventResponse = getEventResultFromMangataTx(events!, [
    "xyk",
    "AssetsSwapped",
  ]);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const mgasAfter = await mangata?.query.getTokenBalance(
    MGA_ASSET_ID.toString(),
    testUser1.keyRingPair.address,
  );
  expect(mgasBef?.reserved).bnEqual(BN_ZERO);
  expect(mgasAfter?.reserved).bnEqual(BN_ZERO);
  expect(mgasBef!.free).bnEqual(mgasAfter!.free);
});
