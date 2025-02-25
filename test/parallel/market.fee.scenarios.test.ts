/*
 *
 * @group parallel
 */

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
let swapAmount: BN;

let firstCurrency: BN;
let secondCurrency: BN;
let thirdCurrency: BN;

async function addTestExtrinsic(
  currencies: [firstCurrency: BN, secondCurrency: BN],
  xYPool: [isExisting: boolean, poolType: string],
  xGaspPool: [isExisting: boolean, poolType: string],
  yGaspPool: [isExisting: boolean, poolType: string],
) {
  const extrinsics: Extrinsic[] = [];
  const meta = await getApi().query.feeLock.feeLockMetadata();
  const amount = stringToBN(
    JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
  ).muln(5);
  if (xYPool[0]) {
    extrinsics.push(
      Market.createPool(
        currencies[0],
        amount,
        currencies[1],
        amount,
        xYPool[1],
      ),
    );
  }
  if (xGaspPool[0]) {
    extrinsics.push(
      Market.createPool(
        GASP_ASSET_ID,
        amount,
        currencies[0],
        amount,
        xGaspPool[1],
      ),
    );
  }
  if (yGaspPool[0]) {
    extrinsics.push(
      Market.createPool(
        GASP_ASSET_ID,
        amount,
        currencies[1],
        amount,
        yGaspPool[1],
      ),
    );
  }
  return extrinsics;
}

async function prepareForMultiswapScenario(
  currencies: [firstCurrency: BN, secondCurrency: BN, thirdCurrency: BN],
  yZPoolType: string,
) {
  const meta = await getApi().query.feeLock.feeLockMetadata();
  const amount = stringToBN(
    JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
  ).muln(5);
  const event = await Sudo.batchAsSudoFinalized(
    Market.createPool(currencies[1], amount, currencies[2], amount, yZPoolType),
    Market.createPool(currencies[0], amount, currencies[2], amount),
    Market.createPool(GASP_ASSET_ID, amount, currencies[2], amount),
    Market.createPool(GASP_ASSET_ID, amount, currencies[1], amount),
    Assets.mintToken(firstCurrency, testUser, amount),
  );
  return event;
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

async function swapTokenAndReceiveError(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN,
  soldAssetAmount: BN,
  failStatus: any = feeLockErrors.FeeLockFail,
  swapType: string = "Sell",
) {
  let error: any;
  let tx: Extrinsic;

  //default swap operation is sellAsset
  tx = Market.sellAsset(liqId, currencies[0], currencies[1], soldAssetAmount);

  if (swapType === "Buy") {
    tx = Market.buyAsset(liqId, currencies[0], currencies[1], soldAssetAmount);
  }

  try {
    await signTx(api, tx, user.keyRingPair);
  } catch (e) {
    error = e;
  }
  expect(error.data).toEqual(failStatus);
}

async function swapTokenAndReceiveSlippageError(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN,
  soldAssetAmount: BN,
  error: any = xykErrors.InsufficientOutputAmount,
  swapType: string = "Sell",
) {
  let tx: Extrinsic;
  //default swap operation is sellAsset
  tx = Market.sellAsset(
    liqId,
    currencies[0],
    currencies[1],
    soldAssetAmount,
    soldAssetAmount,
  );
  //if we need buyAsset, we change extrinsic
  if (swapType === "Buy") {
    tx = Market.buyAsset(
      liqId,
      currencies[0],
      currencies[1],
      soldAssetAmount,
      soldAssetAmount,
    );
  }
  await signTx(api, tx, user.keyRingPair).then((result) => {
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
describe("SingleSell, user has only sold asset", () => {
  test("GIVEN X-Y pool is StableSwap AND sale amount > threshold THEN operation succeeds", async () => {
    const poolEvent = await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getPoolIdFromEvent(poolEvent);

    const sellPrice = stringToBN(
      JSON.parse(
        JSON.stringify(
          await api.rpc.market.calculate_sell_price(
            liqId,
            firstCurrency,
            threshold.muln(3).divn(2),
          ),
        ),
      ),
    );
    await signTx(
      api,
      Market.sellAsset(
        liqId,
        firstCurrency,
        secondCurrency,
        threshold.muln(3).divn(2),
      ),
      testUser.keyRingPair,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    const tokenValue = await testUser.getTokenBalance(secondCurrency);
    expect(tokenValue.free).bnEqual(sellPrice);
  });

  //When we don't mention pool in comments it means that all pool is Xyk
  test("GIVEN sale amount > threshold THEN operation succeeds", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

    const sellPrice = calculate_sell_price_local(
      poolBalance[0],
      poolBalance[1],
      threshold.muln(3).divn(2),
    );

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      sellPrice,
    );
  });

  test("GIVEN sale amount < threshold THEN operation fails", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.divn(2),
    );
  });

  test("GIVEN sold asset is not whitelisted AND sale amount > threshold THEN operation fails", async () => {
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

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
    );
  });

  test("GIVEN assets are not paired with GASP AND sale amount > threshold THEN operation fails", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [false, ""],
        [false, ""],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
    );
  });

  test("GIVEN paired pools are StableSwap AND sold amount > threshold THEN operation fails", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "StableSwap"],
        [true, "StableSwap"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
    );
  });

  test("GIVEN bought asset are in whitelist AND sold amount > threshold THEN operation fails", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [secondCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

    const sellPrice = calculate_sell_price_local(
      poolBalance[0],
      poolBalance[1],
      threshold.muln(3).divn(2),
    );

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      sellPrice,
    );
    const gaspTokenAmount = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      GASP_ASSET_ID,
    );
    expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(BN_ZERO);
  });

  test("GIVEN bought asset are in whitelist AND sold amount < threshold THEN operation fails", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [secondCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.addn(1),
    );
  });
});

describe("SingleSell, user has sold asset and GASP", () => {
  test("GIVEN GASP in the wallet < threshold AND assets are not paired with GASP AND sale amount > threshold THEN operation fails", async () => {
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
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
    );
  });

  test("GIVEN GASP in the wallet < threshold AND sale amount > threshold THEN operation succeeds", async () => {
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
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

    const sellPrice = calculate_sell_price_local(
      poolBalance[0],
      poolBalance[1],
      threshold.muln(3).divn(2),
    );

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      sellPrice,
    );

    const gaspTokenAmount = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      GASP_ASSET_ID,
    );
    expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(BN_ZERO);
  });

  test("GIVEN GASP in the wallet > threshold AND assets are not paired with GASP AND sale amount > threshold THEN operation succeeds", async () => {
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
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

    const sellPrice = calculate_sell_price_local(
      poolBalance[0],
      poolBalance[1],
      threshold.muln(3).divn(2),
    );

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      sellPrice,
    );

    const gaspTokenAmount = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      GASP_ASSET_ID,
    );
    expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(threshold);
  });

  test("GIVEN GASP in the wallet > threshold AND sale amount > threshold THEN operation succeeds", async () => {
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
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

    const sellPrice = calculate_sell_price_local(
      poolBalance[0],
      poolBalance[1],
      threshold.muln(3).divn(2),
    );

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      sellPrice,
    );
    const gaspTokenAmount = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      GASP_ASSET_ID,
    );
    expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(BN_ZERO);
  });
});

describe("SingleSwap scenarios with slippage error, user has only sold asset", () => {
  beforeAll(async () => {
    swapAmount = threshold.muln(3).divn(2);
  });
  test("GIVEN X-Y pool is Stable AND sale amount > threshold THEN operation fails and we take fee", async () => {
    const poolEvent = await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getPoolIdFromEvent(poolEvent);

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );

    await swapTokenAndReceiveSlippageError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      swapAmount,
    );

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );
    expect(tokenDiff).bnEqual(swapAmount.divn(1000).muln(3));
  });

  test("GIVEN sale amount > threshold THEN operation fails and we take fee", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );

    await swapTokenAndReceiveSlippageError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      swapAmount,
    );

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );
    expect(tokenDiff.divn(10e6)).bnEqual(
      swapAmount.divn(1000).muln(3).divn(10e6),
    );
  });

  test("GIVEN X-Y pool is Stable AND buyAsset AND amount > threshold THEN operation fails and we take fee", async () => {
    const poolEvent = await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getPoolIdFromEvent(poolEvent);

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );

    const buyPrice = stringToBN(
      JSON.parse(
        JSON.stringify(
          await api.rpc.market.calculate_buy_price(
            liqId,
            secondCurrency,
            threshold.muln(3).divn(2),
          ),
        ),
      ),
    );

    await swapTokenAndReceiveSlippageError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      swapAmount,
      xykErrors.ExcessiveInputAmount,
      "Buy",
    );

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );

    expect(tokenDiff).bnEqual(buyPrice.divn(1000).muln(3).addn(2));
  });

  test("GIVEN buyAsset AND amount > threshold AND fail on slippage THEN operation fails and we take fee", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
    const buyPrice = calculate_buy_price_local(
      poolBalance[0],
      poolBalance[1],
      swapAmount,
    );

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );

    await swapTokenAndReceiveSlippageError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      swapAmount,
      xykErrors.ExcessiveInputAmount,
      "Buy",
    );

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );
    expect(tokenDiff.divn(10e6)).bnEqual(
      buyPrice.divn(1000).muln(3).divn(10e6),
    );
  });
});

describe("MultiSwap scenarios with slippage error, user has only sold asset", () => {
  beforeEach(async () => {
    [thirdCurrency] = await Assets.setupUserWithCurrencies(
      sudo,
      [threshold.muln(20), threshold.muln(20)],
      sudo,
    );

    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
  });

  test("GIVEN sellAsset operation AND sale amount > threshold THEN operation fails", async () => {
    await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "Xyk",
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getLiquidityAssetId(thirdCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [thirdCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
    );
  });

  test("GIVEN sellAsset operation AND sale amount > threshold AND Y-Z pool is StableSwap THEN operation fails", async () => {
    const poolEvent = await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "StableSwap",
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getPoolIdFromEvent(poolEvent);

    await swapTokenAndReceiveError(
      testUser,
      [thirdCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
    );
  });

  test("GIVEN buyAsset operation AND amount > threshold THEN operation fails", async () => {
    await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "Xyk",
    );

    const liqId = await getLiquidityAssetId(thirdCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [thirdCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Buy",
    );
  });

  test("GIVEN buyAsset operation AND amount > threshold AND Y-Z pool is StableSwap THEN operation fails", async () => {
    const poolEvent = await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "StableSwap",
    );

    const liqId = await getPoolIdFromEvent(poolEvent);

    await swapTokenAndReceiveError(
      testUser,
      [thirdCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Buy",
    );
  });
});

describe("Fee checking scenarios, user has only sold asset and sold amount > user's token amount", () => {
  beforeEach(async () => {
    swapAmount = threshold.muln(3).divn(2);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
  });

  test.skip("TODO:Investigate GIVEN user tokens are enough to pay fee AND X-Y pool is Stable THEN operation fails and we take fee", async () => {
    //we need to mint tokens to user which enough to pay fee
    const poolEvent = await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "StableSwap"],
        [true, "StableSwap"],
      )),
      Assets.mintToken(firstCurrency, testUser, swapAmount.divn(1000).muln(5)),
    );

    const liqId = await getPoolIdFromEvent(poolEvent);

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );

    await signTx(
      api,
      Market.sellAsset(liqId, firstCurrency, secondCurrency, swapAmount),
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
      swapAmount.divn(1000).muln(3).divn(10e6),
    );
  });

  test.skip("TODO:Investigate GIVEN user tokens are not enough to pay fee AND X-Y pool is Stable THEN operation fails", async () => {
    //we need to mint tokens to user which not enough to pay fee
    const poolEvent = await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "StableSwap"],
        [true, "StableSwap"],
      )),
      Assets.mintToken(firstCurrency, testUser, swapAmount.divn(1000).muln(1)),
    );

    const liqId = await getPoolIdFromEvent(poolEvent);

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      swapAmount,
      feeLockErrors.SwapApprovalFail,
    );
  });

  test.skip("TODO:Investigate GIVEN user tokens are not enough to pay fee AND X-Y pool is Xyk THEN operation fails", async () => {
    //we need to mint tokens to user which not enough to pay fee
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "StableSwap"],
        [true, "StableSwap"],
      )),
      Assets.mintToken(firstCurrency, testUser, swapAmount.divn(1000).muln(1)),
    );

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

    await swapTokenAndReceiveError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      swapAmount,
      feeLockErrors.SwapApprovalFail,
    );
  });
});
