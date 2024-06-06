/*
 *
 * @group sdk
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { api, getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { multiSwapBuy, multiSwapSell } from "../../utils/tx";
import {
  BN_TEN_THOUSAND,
  isMultiSwapAssetTransactionSuccessful,
  signTx,
} from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let sudo: User;
let token1: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  // setup users
  sudo = getSudoUser();

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );
});

beforeEach(async () => {
  [testUser1] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintToken(token1, testUser1, BN_TEN_THOUSAND),
  );
});

test("GIVEN buyAsset WHEN operation is confirmed AND isMultiSwapAssetTransactionSuccessful THEN it returns true", async () => {
  const buyAssetEvent = await signTx(
    api,
    Xyk.buyAsset(MGA_ASSET_ID, token1, new BN(1000)),
    testUser1.keyRingPair,
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(buyAssetEvent);

  expect(getEventResultFromMangataTx(buyAssetEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );
  expect(eventResult).toEqual(true);
});

test("GIVEN buyAsset WHEN operation is failed AND isMultiSwapAssetTransactionSuccessful THEN it returns false", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  const buyAssetEvent = await signTx(
    api,
    Xyk.buyAsset(token1, token2, new BN(1000)),
    testUser1.keyRingPair,
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(buyAssetEvent);

  expect(getEventResultFromMangataTx(buyAssetEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicFailed,
  );
  expect(getEventResultFromMangataTx(buyAssetEvent).data).toEqual("NoSuchPool");
  expect(eventResult).toEqual(false);
});

test("GIVEN sellAsset WHEN operation is confirmed AND isMultiSwapAssetTransactionSuccessful THEN it returns true", async () => {
  const sellAssetEvent = await signTx(
    api,
    Xyk.sellAsset(MGA_ASSET_ID, token1, new BN(1000)),
    testUser1.keyRingPair,
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(sellAssetEvent);

  expect(getEventResultFromMangataTx(sellAssetEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );
  expect(eventResult).toEqual(true);
});

test("GIVEN sellAsset WHEN operation is failed AND isMultiSwapAssetTransactionSuccessful THEN it returns false", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  const sellAssetEvent = await signTx(
    api,
    Xyk.sellAsset(token1, token2, new BN(1000)),
    testUser1.keyRingPair,
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(sellAssetEvent);

  expect(getEventResultFromMangataTx(sellAssetEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicFailed,
  );
  expect(getEventResultFromMangataTx(sellAssetEvent).data).toEqual(
    "NoSuchPool",
  );
  expect(eventResult).toEqual(false);
});

test("GIVEN multiSwapBuy WHEN operation is confirmed AND isMultiSwapAssetTransactionSuccessful THEN it returns true", async () => {
  const tokenIds = [MGA_ASSET_ID, token1];

  const multiSwapBuyEvent = await multiSwapBuy(
    testUser1,
    tokenIds,
    new BN(1000),
    BN_TEN_THOUSAND,
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(multiSwapBuyEvent);

  expect(getEventResultFromMangataTx(multiSwapBuyEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );
  expect(eventResult).toEqual(true);
});

test("GIVEN multiSwapBuy WHEN operation is failed AND isMultiSwapAssetTransactionSuccessful THEN it returns false", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  const tokenIds = [token1, token2];

  const multiSwapBuyEvent = await multiSwapBuy(
    testUser1,
    tokenIds,
    new BN(1000),
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(multiSwapBuyEvent);

  expect(getEventResultFromMangataTx(multiSwapBuyEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicFailed,
  );
  expect(getEventResultFromMangataTx(multiSwapBuyEvent).data).toEqual(
    "NoSuchPool",
  );
  expect(eventResult).toEqual(false);
});

test("GIVEN multiSwapSell WHEN operation is confirmed AND isMultiSwapAssetTransactionSuccessful THEN it returns true", async () => {
  const tokenIds = [MGA_ASSET_ID, token1];

  const multiSwapSellEvent = await multiSwapSell(
    testUser1,
    tokenIds,
    new BN(1000),
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(multiSwapSellEvent);

  expect(getEventResultFromMangataTx(multiSwapSellEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );
  expect(eventResult).toEqual(true);
});

test("GIVEN multiSwapSell WHEN operation is failed AND isMultiSwapAssetTransactionSuccessful THEN it returns false", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  const tokenIds = [token1, token2];

  const multiSwapSellEvent = await multiSwapSell(
    testUser1,
    tokenIds,
    new BN(1000),
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(multiSwapSellEvent);

  expect(getEventResultFromMangataTx(multiSwapSellEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicFailed,
  );
  expect(getEventResultFromMangataTx(multiSwapSellEvent).data).toEqual(
    "NoSuchPool",
  );
  expect(eventResult).toEqual(false);
});
