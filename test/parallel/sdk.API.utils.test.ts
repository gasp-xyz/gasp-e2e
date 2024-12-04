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
<<<<<<< HEAD
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  getLiquidityAssetId,
  multiSwapBuyMarket,
  multiSwapSellMarket,
} from "../../utils/tx";
import {
  BN_MILLION,
=======
import { Xyk } from "../../utils/xyk";
import { GASP_ASSET_ID, MAX_BALANCE } from "../../utils/Constants";
import { multiSwapBuyMarket, multiSwapSellMarket } from "../../utils/tx";
import {
  BN_MILLION,
  BN_ONE,
>>>>>>> feature/creatingMarketClassMultiswap
  BN_TEN_THOUSAND,
  isMultiSwapAssetTransactionSuccessful,
  signTx,
} from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let sudo: User;
let token1: BN;
let liqId: BN;
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
      Market.createPool(
        GASP_ASSET_ID,
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
  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);
});

test("GIVEN buyAsset WHEN operation is confirmed AND isMultiSwapAssetTransactionSuccessful THEN it returns true", async () => {
  const buyAssetEvent = await signTx(
    api,
    Market.buyAsset(liqId, token1, GASP_ASSET_ID, new BN(1000)),
    testUser1.keyRingPair,
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(buyAssetEvent);

  expect(getEventResultFromMangataTx(buyAssetEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );
  expect(eventResult).toEqual(true);
});

test("GIVEN buyAsset WHEN operation is failed AND isMultiSwapAssetTransactionSuccessful THEN it returns false", async () => {
  const buyAssetEvent = await signTx(
    api,
    Market.buyAsset(BN_MILLION, token1, GASP_ASSET_ID, new BN(1000)),
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
    Market.sellAsset(liqId, token1, GASP_ASSET_ID, new BN(1000)),
    testUser1.keyRingPair,
  );

  const eventResult = isMultiSwapAssetTransactionSuccessful(sellAssetEvent);

  expect(getEventResultFromMangataTx(sellAssetEvent).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );
  expect(eventResult).toEqual(true);
});

test("GIVEN sellAsset WHEN operation is failed AND isMultiSwapAssetTransactionSuccessful THEN it returns false", async () => {
  const sellAssetEvent = await signTx(
    api,
    Market.sellAsset(BN_MILLION, token1, GASP_ASSET_ID, new BN(1000)),
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
  const tokenIds = [GASP_ASSET_ID, token1];

  const multiSwapBuyEvent = await multiSwapBuyMarket(
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
  const multiSwapBuyEvent = await signTx(
    api,
    Market.multiswapAssetBuy(
      [BN_MILLION],
      GASP_ASSET_ID,
      new BN(1000),
      token1,
      MAX_BALANCE,
    ),
    testUser.keyRingPair,
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
  const tokenIds = [GASP_ASSET_ID, token1];

  const multiSwapSellEvent = await multiSwapSellMarket(
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
  const multiSwapSellEvent = await signTx(
    api,
    Market.multiswapAssetSell(
      [BN_MILLION],
      GASP_ASSET_ID,
      new BN(1000),
      token1,
      BN_ONE,
    ),
    testUser.keyRingPair,
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
