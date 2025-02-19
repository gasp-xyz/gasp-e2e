import { jest } from "@jest/globals";
import { BN } from "ethereumjs-util";
import { User } from "../../utils/User";
import { getApi, initApi } from "../../utils/api";
import {
  Extrinsic,
  getSudoUser,
  setupApi,
  setupUsers,
} from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Market } from "../../utils/market";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  calculate_buy_price_local,
  calculate_sell_price_local,
  getBalanceOfPool,
  getLiquidityAssetId,
  getPoolIdFromEvent,
  getTokensAccountInfo,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { feeLockErrors, stringToBN, xykErrors } from "../../utils/utils";
import { ApiPromise } from "@polkadot/api";
import { BN_ZERO, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;

let api: ApiPromise;
let threshold: BN;

let firstCurrency: BN;
let secondCurrency: BN;

async function addTestExtrinsic(
  currencies: [firstCurrency: BN, secondCurrency: BN],
  xYPool: [isExisting: boolean, poolType: string],
  xGaspPool: [isExisting: boolean, poolType: string],
  yGaspPool: [isExisting: boolean, poolType: string],
) {
  const extrinsics: Extrinsic[] = [];
  if (xYPool[0]) {
    extrinsics.push(
      Market.createPool(
        currencies[0],
        threshold.muln(5),
        currencies[1],
        threshold.muln(5),
        xYPool[1],
      ),
    );
  }
  if (xGaspPool[0]) {
    extrinsics.push(
      Market.createPool(
        GASP_ASSET_ID,
        threshold.muln(5),
        currencies[0],
        threshold.muln(5),
        xGaspPool[1],
      ),
    );
  }
  if (yGaspPool[0]) {
    extrinsics.push(
      Market.createPool(
        GASP_ASSET_ID,
        threshold.muln(5),
        currencies[1],
        threshold.muln(5),
        yGaspPool[1],
      ),
    );
  }
  return extrinsics;
}

async function addTestMultiswapExtrinsic(
  currencies: [firstCurrency: BN, secondCurrency: BN, thirdCurrency: BN],
  yZPool: [isExisting: boolean, poolType: string],
  xZPool: [isExisting: boolean, poolType: string],
  zGaspPool: [isExisting: boolean, poolType: string],
  yGaspPool: [isExisting: boolean, poolType: string],
) {
  const extrinsics: Extrinsic[] = [];
  if (yZPool[0]) {
    extrinsics.push(
      Market.createPool(
        currencies[1],
        threshold.muln(5),
        currencies[2],
        threshold.muln(5),
        yZPool[1],
      ),
    );
  }
  if (xZPool[0]) {
    extrinsics.push(
      Market.createPool(
        currencies[0],
        threshold.muln(5),
        currencies[2],
        threshold.muln(5),
        xZPool[1],
      ),
    );
  }
  if (zGaspPool[0]) {
    extrinsics.push(
      Market.createPool(
        GASP_ASSET_ID,
        threshold.muln(5),
        currencies[2],
        threshold.muln(5),
        zGaspPool[1],
      ),
    );
  }
  if (yGaspPool[0]) {
    extrinsics.push(
      Market.createPool(
        GASP_ASSET_ID,
        threshold.muln(5),
        currencies[1],
        threshold.muln(5),
        yGaspPool[1],
      ),
    );
  }
  return extrinsics;
}

async function sellTokenAndReceiveSuccess(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN,
  soldAssetAmount: BN,
  sellPrice: BN,
) {
  await signTx(
    api,
    Market.sellAsset(liqId, currencies[0], currencies[1], soldAssetAmount),
    user.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const tokenValue = await user.getTokenBalance(secondCurrency);
  expect(tokenValue.free).bnEqual(sellPrice);
}

async function sellTokenAndReceiveFail(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN,
  soldAssetAmount: BN,
  failStatus: any = feeLockErrors.FeeLockFail,
) {
  let error: any;

  try {
    await signTx(
      api,
      Market.sellAsset(liqId, currencies[0], currencies[1], soldAssetAmount),
      user.keyRingPair,
    );
  } catch (e) {
    error = e;
  }
  expect(error.data).toEqual(failStatus);
}

async function sellTokenAndReceiveFailSlippage(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN,
  soldAssetAmount: BN,
  error: any = xykErrors.InsufficientOutputAmount,
) {
  await signTx(
    api,
    Market.sellAsset(
      liqId,
      currencies[0],
      currencies[1],
      soldAssetAmount,
      soldAssetAmount,
    ),
    user.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(error);
  });
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  api = getApi();
  await setupApi();
  setupUsers();

  const meta = await api.query.feeLock.feeLockMetadata();
  threshold = stringToBN(
    JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
  );
  sudo = getSudoUser();

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(sudo),
  );
});

beforeEach(async () => {
  [testUser] = setupUsers();

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [threshold.muln(20), threshold.muln(20)],
    sudo,
  );
});

test("GIVEN user has only sold asset AND X-Y pool is StableSwap AND sale amount > threshold THEN operation succeeds", async () => {
  const poolEvent = await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "StableSwap"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);

  // const sellPrice = await api.call.marketRuntimeApi.calculateSellPrice(
  //  liqId,
  //  firstCurrency,
  //  threshold.add(threshold.divn(2)),
  // );

  await signTx(
    api,
    Market.sellAsset(
      liqId,
      firstCurrency,
      secondCurrency,
      threshold.add(threshold.divn(2)),
    ),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const tokenValue = await testUser.getTokenBalance(secondCurrency);
  expect(tokenValue.free).bnLt(threshold.add(threshold.divn(2)));
  expect(tokenValue.free).bnGt(threshold);
});

//When we don't mention pool in comments it means that all pool is Xyk
test("GIVEN user has only sold asset AND sale amount > threshold THEN operation succeeds", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

  const sellPrice = calculate_sell_price_local(
    poolBalance[0],
    poolBalance[1],
    threshold.add(threshold.divn(2)),
  );

  await sellTokenAndReceiveSuccess(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
    sellPrice,
  );
});

test("GIVEN user has only sold asset AND sale amount < threshold THEN operation fails", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.divn(2),
  );
});

test("GIVEN user has only sold asset AND this asset is not whitelisted AND sale amount > threshold THEN operation fails", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
  );
});

test("GIVEN user has only sold asset AND assets are not paired with GASP AND sale amount > threshold THEN operation fails", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [false, ""],
      [false, ""],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
  );
});

test("GIVEN user has sold asset and GASP < threshold AND assets are not paired with GASP AND sale amount > threshold THEN operation fails", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [false, ""],
      [false, ""],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    Assets.mintToken(GASP_ASSET_ID, testUser, threshold.divn(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
  );
});

test("GIVEN user has sold asset and GASP < threshold AND sale amount > threshold THEN operation succeeds", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    Assets.mintToken(GASP_ASSET_ID, testUser, threshold.divn(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

  const sellPrice = calculate_sell_price_local(
    poolBalance[0],
    poolBalance[1],
    threshold.add(threshold.divn(2)),
  );

  await sellTokenAndReceiveSuccess(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
    sellPrice,
  );
});

test("GIVEN user has sold asset and GASP token > threshold AND assets are not paired with GASP AND sale amount > threshold THEN operation succeeds", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [false, ""],
      [false, ""],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    Assets.mintToken(GASP_ASSET_ID, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

  const sellPrice = calculate_sell_price_local(
    poolBalance[0],
    poolBalance[1],
    threshold.add(threshold.divn(2)),
  );

  await sellTokenAndReceiveSuccess(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
    sellPrice,
  );

  const gaspTokenAmount = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    GASP_ASSET_ID,
  );
  expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(threshold);
});

test("GIVEN user has sold asset and GASP > threshold AND sale amount > threshold THEN operation succeeds", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    Assets.mintToken(GASP_ASSET_ID, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

  const sellPrice = calculate_sell_price_local(
    poolBalance[0],
    poolBalance[1],
    threshold.add(threshold.divn(2)),
  );

  await sellTokenAndReceiveSuccess(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
    sellPrice,
  );
  const gaspTokenAmount = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    GASP_ASSET_ID,
  );
  expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(BN_ZERO);
});

test("GIVEN user has only sold asset AND X-Y pool is Stable AND sale amount > threshold AND fail on slippage THEN operation fails and we take fee", async () => {
  const poolEvent = await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "StableSwap"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);
  const soldAmount = threshold.add(threshold.divn(2));

  const tokenValueBefore = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );

  await sellTokenAndReceiveFailSlippage(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    soldAmount,
  );

  const tokenValueAfter = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );
  const tokenDiff = stringToBN(tokenValueBefore.free).sub(
    stringToBN(tokenValueAfter.free),
  );
  expect(tokenDiff).bnEqual(soldAmount.divn(1000).muln(3));
});

test("GIVEN user has only sold asset AND sale amount > threshold AND fail on slippage THEN operation fails and we take fee", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const soldAmount = threshold.add(threshold.divn(2));

  const tokenValueBefore = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );

  await sellTokenAndReceiveFailSlippage(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    soldAmount,
  );

  const tokenValueAfter = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );
  const tokenDiff = stringToBN(tokenValueBefore.free).sub(
    stringToBN(tokenValueAfter.free),
  );
  expect(tokenDiff).bnEqual(soldAmount.divn(1000).muln(3));
});

test("GIVEN user has only sold asset AND X-Y pool is Stable AND buyAsset AND amount > threshold AND fail on slippage THEN operation fails and we take fee", async () => {
  const poolEvent = await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "StableSwap"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);
  const buyAmount = threshold.add(threshold.divn(2));

  const tokenValueBefore = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );

  // const buyPrice = await api.call.marketRuntimeApi.calculateBuyPrice(
  //  liqId,
  //  firstCurrency,
  //  threshold.add(threshold.divn(2)),
  // );

  await signTx(
    api,
    Market.buyAsset(liqId, firstCurrency, secondCurrency, buyAmount, buyAmount),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.ExcessiveInputAmount);
  });
  const tokenValueAfter = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );
  const tokenDiff = stringToBN(tokenValueBefore.free).sub(
    stringToBN(tokenValueAfter.free),
  );

  //This is a temporary check until the RPC is repaired.
  expect(tokenDiff).bnLte(buyAmount.divn(100));
  expect(tokenDiff).bnGt(BN_ZERO);
});

test("GIVEN user has only sold asset  AND buyAsset AND amount > threshold AND fail on slippage THEN operation fails and we take fee", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
  const buyAmount = threshold.add(threshold.divn(2));
  const buyingPrice = calculate_buy_price_local(
    poolBalance[0],
    poolBalance[1],
    buyAmount,
  );

  const tokenValueBefore = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );

  await signTx(
    api,
    Market.buyAsset(liqId, firstCurrency, secondCurrency, buyAmount, buyAmount),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(xykErrors.ExcessiveInputAmount);
  });
  const tokenValueAfter = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );
  const tokenDiff = stringToBN(tokenValueBefore.free).sub(
    stringToBN(tokenValueAfter.free),
  );
  expect(tokenDiff.divn(10e6)).bnEqual(
    buyingPrice.divn(1000).muln(3).divn(10e6),
  );
});

test("GIVEN user has only sold asset AND sale amount > threshold AND Multiswap operation AND fail on slippage THEN operation fails", async () => {
  const [thirdCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [threshold.muln(20), threshold.muln(20)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    ...(await addTestMultiswapExtrinsic(
      [firstCurrency, secondCurrency, thirdCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);
  await updateFeeLockMetadata(sudo, null, null, null, [[thirdCurrency, true]]);

  const liqId = await getLiquidityAssetId(thirdCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [thirdCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
    feeLockErrors.SwapApprovalFail,
  );
});

test("GIVEN user has only sold asset AND sale amount > threshold AND Y-Z pool is StableSwap AND Multiswap operation AND fail on slippage THEN operation fails", async () => {
  const [thirdCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [threshold.muln(20), threshold.muln(20)],
    sudo,
  );

  const poolEvent = await Sudo.batchAsSudoFinalized(
    ...(await addTestMultiswapExtrinsic(
      [firstCurrency, secondCurrency, thirdCurrency],
      [true, "StableSwap"],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);
  await updateFeeLockMetadata(sudo, null, null, null, [[thirdCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);

  await sellTokenAndReceiveFail(
    testUser,
    [thirdCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
    feeLockErrors.SwapApprovalFail,
  );
});

test("GIVEN user has only sold asset AND buyAsset AND amount > threshold AND Multiswap operation AND fail on slippage THEN operation fails", async () => {
  const [thirdCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [threshold.muln(20), threshold.muln(20)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    ...(await addTestMultiswapExtrinsic(
      [firstCurrency, secondCurrency, thirdCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);
  await updateFeeLockMetadata(sudo, null, null, null, [[thirdCurrency, true]]);

  const liqId = await getLiquidityAssetId(thirdCurrency, secondCurrency);
  const buyAmount = threshold.add(threshold.divn(2));
  let error: any;

  try {
    await signTx(
      api,
      Market.buyAsset(liqId, thirdCurrency, secondCurrency, buyAmount),
      testUser.keyRingPair,
    );
  } catch (e) {
    error = e;
  }

  expect(error.data).toEqual(feeLockErrors.SwapApprovalFail);
});

test("GIVEN user has only sold asset AND buyAsset AND amount > threshold AND Y-Z pool is StableSwap AND Multiswap operation AND fail on slippage THEN operation fails", async () => {
  const [thirdCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [threshold.muln(20), threshold.muln(20)],
    sudo,
  );

  const poolEvent = await Sudo.batchAsSudoFinalized(
    ...(await addTestMultiswapExtrinsic(
      [firstCurrency, secondCurrency, thirdCurrency],
      [true, "StableSwap"],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);
  await updateFeeLockMetadata(sudo, null, null, null, [[thirdCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);
  const buyAmount = threshold.add(threshold.divn(2));
  let error: any;

  try {
    await signTx(
      api,
      Market.buyAsset(liqId, thirdCurrency, secondCurrency, buyAmount),
      testUser.keyRingPair,
    );
  } catch (e) {
    error = e;
  }

  expect(error.data).toEqual(feeLockErrors.SwapApprovalFail);
});

test("GIVEN user has only sold asset AND GASP Paired pools are StableSwap AND sold amount > threshold THEN operation fails", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "StableSwap"],
      [true, "StableSwap"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
  );
});

test("GIVEN user has only sold asset AND bought asset are in whitelist AND sold amount > threshold THEN operation fails", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[secondCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

  const sellPrice = calculate_sell_price_local(
    poolBalance[0],
    poolBalance[1],
    threshold.add(threshold.divn(2)),
  );

  await sellTokenAndReceiveSuccess(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.add(threshold.divn(2)),
    sellPrice,
  );
  const gaspTokenAmount = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    GASP_ASSET_ID,
  );
  expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(BN_ZERO);
});

test("GIVEN user has only sold asset AND bought asset are in whitelist AND sold amount < threshold THEN operation fails", async () => {
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[secondCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    threshold.addn(1),
  );
});

test("GIVEN user has only sold asset (enough to pay fee) AND sold amount > user's token amount THEN operation fails and we take fee", async () => {
  const soldAmount = threshold.add(threshold.divn(2));

  //we need to mint tokens to user which enough to pay fee
  const poolEvent = await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "StableSwap"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, soldAmount.divn(1000).muln(5)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);

  const tokenValueBefore = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );

  await signTx(
    api,
    Market.sellAsset(liqId, firstCurrency, secondCurrency, soldAmount),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("BalanceTooLow");
  });
  const tokenValueAfter = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );
  const tokenDiff = stringToBN(tokenValueBefore.free).sub(
    stringToBN(tokenValueAfter.free),
  );
  expect(tokenDiff.divn(10e6)).bnEqual(
    soldAmount.divn(1000).muln(3).divn(10e6),
  );
});

test("GIVEN user has only sold asset (not enough to pay fee) AND sold amount > user's token amount AND X-Y pool is Stable THEN operation fails", async () => {
  const soldAmount = threshold.add(threshold.divn(2));

  //we need to mint tokens to user which not enough to pay fee
  const poolEvent = await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "StableSwap"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, soldAmount.divn(1000).muln(1)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    soldAmount,
    feeLockErrors.SwapApprovalFail,
  );
});

test("GIVEN user has only sold asset (not enough to pay fee) AND sold amount > user's token amount THEN operation fails", async () => {
  const soldAmount = threshold.add(threshold.divn(2));

  //we need to mint tokens to user which not enough to pay fee
  await Sudo.batchAsSudoFinalized(
    ...(await addTestExtrinsic(
      [firstCurrency, secondCurrency],
      [true, "Xyk"],
      [true, "Xyk"],
      [true, "Xyk"],
    )),
    Assets.mintToken(firstCurrency, testUser, soldAmount.divn(1000).muln(1)),
  );
  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await sellTokenAndReceiveFail(
    testUser,
    [firstCurrency, secondCurrency],
    liqId,
    soldAmount,
    feeLockErrors.SwapApprovalFail,
  );
});
