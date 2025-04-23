/*
 *
 * @group marketSwap
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
import { Market, rpcGetPoolId } from "../../utils/market";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  calculate_sell_price_local_no_fee,
  getBalanceOfPool,
  getPoolIdFromEvent,
  getTokensAccountInfo,
  getUserAssets,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { feeLockErrors, stringToBN, xykErrors } from "../../utils/utils";
import { ApiPromise } from "@polkadot/api";
import { BN_ZERO, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, filterEventData } from "../../utils/eventListeners";
import {
  getFeeLockMetadata,
  rpcCalculateSellPrice,
} from "../../utils/feeLockHelper";
import { testLog } from "../../utils/Logger";
import { FeeLock } from "../../utils/FeeLock";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;

let api: ApiPromise;
let threshold: BN;
let requiredGaspToLock: BN;
let swappingAmount: BN;

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
  const meta = await getFeeLockMetadata();
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
  const meta = await getFeeLockMetadata();
  const amount = stringToBN(
    JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
  ).muln(5);
  return await Sudo.batchAsSudoFinalized(
    Market.createPool(currencies[1], amount, currencies[2], amount, yZPoolType),
    Market.createPool(currencies[0], amount, currencies[2], amount),
    Market.createPool(GASP_ASSET_ID, amount, currencies[2], amount),
    Market.createPool(GASP_ASSET_ID, amount, currencies[1], amount),
    Assets.mintToken(currencies[0], testUser, amount),
  );
}

async function sellTokenAndReceiveSuccess(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN | BN[],
  soldAssetAmount: BN,
  skipChecks = false,
) {
  const poolBalance = await getBalanceOfPool(currencies[0], currencies[1]);

  const sellPrice = await rpcCalculateSellPrice(
    liqId,
    currencies[0],
    soldAssetAmount,
  );

  testLog.getLog().info("selling asset " + currencies[0]);
  await signTx(
    api,
    Market.sellAsset(liqId, currencies[0], currencies[1], soldAssetAmount),
    user.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const sellPriceNoFee = calculate_sell_price_local_no_fee(
    poolBalance[0],
    poolBalance[1],
    soldAssetAmount.muln(997).divn(1000),
  );
  if (!skipChecks) {
    const tokenValue = await user.getTokenBalance(currencies[1]);
    expect(tokenValue.free).bnEqual(sellPrice);
    expect(sellPriceNoFee).bnEqual(sellPrice);
  }
}

async function getSwappingTokenError(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN | BN[],
  soldAssetAmount: BN,
  matchErrorString: any = xykErrors.NotEnoughAssetsForFeeLock,
  swapType: string = "Sell",
  isError = false,
) {
  let error: any;
  let tx: Extrinsic;

  //default swap operation is sellAsset
  tx = Market.sellAsset(liqId, currencies[0], currencies[1], soldAssetAmount);

  if (swapType === "Buy") {
    tx = await Market.buyAsset(
      liqId,
      currencies[0],
      currencies[1],
      soldAssetAmount,
      soldAssetAmount.muln(1000),
    );
  }
  testLog
    .getLog()
    .info(
      "trying to swap asset " +
        currencies[0] +
        " and " +
        currencies[1] +
        " and excepting error " +
        matchErrorString,
    );
  if (isError) {
    try {
      await signTx(api, tx, user.keyRingPair);
    } catch (e) {
      error = e;
    }
    expect(error.data).toEqual(matchErrorString);
  } else {
    await signTx(api, tx, user.keyRingPair).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(matchErrorString);
    });
  }
}

async function swapTokenAndReceiveSlippageError(
  user: User,
  currencies: [firstCurrency: BN, secondCurrency: BN],
  liqId: BN,
  soldAssetAmount: BN,
  matchErrorString: any = xykErrors.InsufficientOutputAmount,
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
    tx = await Market.buyAsset(
      liqId,
      currencies[0],
      currencies[1],
      soldAssetAmount,
      soldAssetAmount,
    );
  }
  testLog
    .getLog()
    .info(
      "swapping assets " +
        currencies[0] +
        " and " +
        currencies[0] +
        " and excepting error " +
        matchErrorString,
    );
  await signTx(api, tx, user.keyRingPair).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(matchErrorString);
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

  const meta = await getFeeLockMetadata();
  threshold = stringToBN(
    JSON.parse(JSON.stringify(meta)).swapValueThreshold.toString(),
  );
  sudo = getSudoUser();
  requiredGaspToLock = stringToBN(meta.feeLockAmount.toString());
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
  await Sudo.batchAsSudoFinalized(
    ...FeeLock.updateTokenValueThresholdMulti(
      [firstCurrency, secondCurrency],
      threshold,
    ),
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
      Assets.mintNative(testUser),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await getPoolIdFromEvent(poolEvent);
    const sellAmount = threshold.muln(3).divn(2);

    const sellPrice = await rpcCalculateSellPrice(
      liqId,
      firstCurrency,
      sellAmount,
    );

    await signTx(
      api,
      Market.sellAsset(liqId, firstCurrency, secondCurrency, sellAmount),
      testUser.keyRingPair,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    // TODO: change this code when we find the possibility to calculate sell price without fee for stableswap pools
    // const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

    // const sellPriceNoFee = calculate_sell_price_local_no_fee(
    //   poolBalance[0],
    //   poolBalance[1],
    //   sellAmount.muln(997).divn(1000),
    // );

    const tokenValue = await testUser.getTokenBalance(secondCurrency);
    expect(tokenValue.free).bnEqual(sellPrice);
    // expect(sellPriceNoFee).bnEqual(sellPrice);
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

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    const sellAmount = threshold.muln(3).divn(2);

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      liqId,
      sellAmount,
    );
  });

  test("GIVEN sale amount < threshold THEN operation fails on client", async () => {
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

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      liqId,
      threshold.divn(2),
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });

  test("GIVEN sold asset is not whitelisted AND sale amount > threshold THEN operation fails on client", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });

  test("GIVEN assets are not paired with GASP AND sale amount > threshold THEN operation fails on client", async () => {
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

    const liqId = await rpcGetPoolId(firstCurrency, secondCurrency);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });

  test("GIVEN paired pools are StableSwap AND sold amount > threshold THEN swap happens", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "StableSwap"],
        [true, "StableSwap"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId1 = await rpcGetPoolId(firstCurrency, secondCurrency);
    const liqId2 = await rpcGetPoolId(secondCurrency, GASP_ASSET_ID);
    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      [liqId1, liqId2],
      threshold.muln(3).divn(2),
      true,
    );
  });

  test("GIVEN ONLY bought asset are in whitelist AND sold amount > threshold THEN fail on client", async () => {
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

    const liqId = await rpcGetPoolId(secondCurrency, GASP_ASSET_ID);
    const liqId2 = await rpcGetPoolId(firstCurrency, secondCurrency);
    const sellAmount = threshold.muln(3).divn(2);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      [liqId2, liqId],
      sellAmount,
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
    const gaspTokenAmount = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      GASP_ASSET_ID,
    );
    expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(BN_ZERO);
  });

  test("GIVEN sold asset are in whitelist AND sold amount < threshold THEN operation fails on client", async () => {
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

    const liqId = await rpcGetPoolId(secondCurrency, GASP_ASSET_ID);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.subn(1),
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });
});

describe("SingleSell, user has sold asset and GASP", () => {
  test("GIVEN GASP in the wallet < threshold AND assets are not paired with GASP AND sale amount > threshold THEN operation fails on client", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [false, ""],
        [false, ""],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
      Assets.mintToken(GASP_ASSET_ID, testUser, requiredGaspToLock.divn(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await rpcGetPoolId(firstCurrency, secondCurrency);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });

  test("GIVEN GASP in the wallet < min AND sale amount > threshold THEN operation succeeds", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
      Assets.mintToken(GASP_ASSET_ID, testUser, requiredGaspToLock.divn(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);
    const sellAmount = threshold.muln(3).divn(2);

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      liqId,
      sellAmount,
      true,
    );

    const gaspTokenAmount = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      GASP_ASSET_ID,
    );
    expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(BN_ZERO);
  });

  test("GIVEN GASP in the wallet > threshold AND assets are not paired with GASP AND sale amount > threshold THEN operation succeeds and GASPs are locked", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [false, ""],
        [false, ""],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
      Assets.mintToken(GASP_ASSET_ID, testUser, requiredGaspToLock.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await rpcGetPoolId(firstCurrency, secondCurrency);
    const sellAmount = threshold.muln(3).divn(2);

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      sellAmount,
    );

    const gaspTokenAmount = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      GASP_ASSET_ID,
    );
    expect(stringToBN(gaspTokenAmount.reserved)).bnEqual(requiredGaspToLock);
  });

  test("GIVEN GASP in the wallet > threshold AND sale amount > threshold THEN operation succeeds and GASPs are unlocked", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
      Assets.mintToken(GASP_ASSET_ID, testUser, requiredGaspToLock.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);

    const liqId = await rpcGetPoolId(firstCurrency, secondCurrency);
    const sellAmount = threshold.muln(3).divn(2);

    await sellTokenAndReceiveSuccess(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      sellAmount,
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
    swappingAmount = threshold.muln(3).divn(2);
  });
  test("GIVEN X-Y pool is Stable AND sale amount GT threshold THEN operation fails and we take fee", async () => {
    const localSecToken = GASP_ASSET_ID;
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "StableSwap"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(firstCurrency, swappingAmount),
      ),
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(secondCurrency, swappingAmount),
      ),
    );

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );

    await swapTokenAndReceiveSlippageError(
      testUser,
      [firstCurrency, localSecToken],
      liqId,
      swappingAmount,
    );

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );
    expect(tokenDiff).bnEqual(swappingAmount.divn(1000).muln(3));
  });

  test("GIVEN sale amount GT threshold THEN operation fails and we take fee", async () => {
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
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(firstCurrency, swappingAmount),
      ),
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(secondCurrency, swappingAmount),
      ),
    );

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    await swapTokenAndReceiveSlippageError(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      liqId,
      swappingAmount,
    );

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );
    expect(tokenDiff.divn(10e6)).bnEqual(
      swappingAmount.divn(1000).muln(3).divn(10e6),
    );
  });

  test("GIVEN X-Y pool is Stable AND buyAsset AND amount GT threshold THEN operation fails and we take fee", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "StableSwap"],
        [true, "Xyk"],
      )),
      Assets.mintToken(firstCurrency, testUser, threshold.muln(2)),
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(firstCurrency, swappingAmount),
      ),
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(secondCurrency, swappingAmount),
      ),
    );

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const err = feeLockErrors.SwapApprovalFail;
    let except = false;
    try {
      await swapTokenAndReceiveSlippageError(
        testUser,
        [firstCurrency, GASP_ASSET_ID],
        liqId,
        swappingAmount,
        xykErrors.InsufficientInputAmount,
        "Buy",
      );
    } catch (error: any) {
      except = true;
      expect(error.data).toEqual(err);
    }
    expect(except).toBeTruthy();

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );

    expect(tokenDiff).bnEqual(BN_ZERO);
  });

  test("GIVEN buyAsset GT amount WHEN threshold AND fail on slippage THEN operation fails and we take fee", async () => {
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
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(firstCurrency, swappingAmount),
      ),
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(secondCurrency, swappingAmount),
      ),
    );

    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);
    const tokenValueBefore = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const err = feeLockErrors.SwapApprovalFail;
    let except = false;
    try {
      await swapTokenAndReceiveSlippageError(
        testUser,
        [firstCurrency, GASP_ASSET_ID],
        liqId,
        swappingAmount,
        xykErrors.InsufficientInputAmount,
        "Buy",
      );
    } catch (error: any) {
      except = true;
      expect(error.data).toEqual(err);
    }
    expect(except).toBeTruthy();

    const tokenValueAfter = await getTokensAccountInfo(
      testUser.keyRingPair.address,
      firstCurrency,
    );
    const tokenDiff = stringToBN(tokenValueBefore.free).sub(
      stringToBN(tokenValueAfter.free),
    );
    expect(tokenDiff).bnEqual(BN_ZERO);
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

  test("GIVEN sellAsset operation AND sale amount > threshold THEN operation fails on client", async () => {
    await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "Xyk",
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [secondCurrency, true],
    ]);

    const liqId = await rpcGetPoolId(thirdCurrency, secondCurrency);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });

  test("GIVEN sellAsset operation AND sale amount > threshold AND Y-Z pool is StableSwap THEN operation fails on client", async () => {
    const poolEvent = await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "StableSwap",
    );
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [secondCurrency, true],
    ]);

    const liqId = await getPoolIdFromEvent(poolEvent);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });

  test("GIVEN buyAsset operation AND amount > threshold THEN operation fails on client", async () => {
    await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "Xyk",
    );

    const liqId = await rpcGetPoolId(thirdCurrency, secondCurrency);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [secondCurrency, true],
    ]);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Buy",
      true,
    );
  });

  test("GIVEN buyAsset operation AND amount > threshold AND Y-Z pool is StableSwap THEN operation fails on client", async () => {
    const poolEvent = await prepareForMultiswapScenario(
      [firstCurrency, secondCurrency, thirdCurrency],
      "StableSwap",
    );

    const liqId = await getPoolIdFromEvent(poolEvent);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [secondCurrency, true],
    ]);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      threshold.muln(3).divn(2),
      feeLockErrors.SwapApprovalFail,
      "Buy",
      true,
    );
  });
});

describe("Fee checking scenarios, user has only sold asset and sold amount > user's token amount", () => {
  beforeEach(async () => {
    swappingAmount = threshold.muln(3).divn(2);
    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
  });

  test("GIVEN user tokens are enough to pay fee AND X-Y pool is Stable THEN fail on client", async () => {
    //we need to mint tokens to user which enough to pay fee
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "StableSwap"],
        [true, "StableSwap"],
      )),
      Assets.mintToken(
        firstCurrency,
        testUser,
        swappingAmount.divn(1000).muln(5),
      ),
    );

    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    await Sudo.asSudoFinalized(
      Sudo.sudo(
        FeeLock.updateTokenValueThreshold(
          firstCurrency,
          swappingAmount.subn(1),
        ),
      ),
    );
    await getSwappingTokenError(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      liqId,
      swappingAmount,
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });

  test.skip("DUPLCATED.. GIVEN user tokens are not enough to pay fee AND X-Y pool is Stable THEN operation fails", async () => {
    //we need to mint tokens to user which not enough to pay fee
    const poolEvent = await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "StableSwap"],
        [true, "StableSwap"],
        [true, "StableSwap"],
      )),
      Assets.mintToken(
        firstCurrency,
        testUser,
        swappingAmount.divn(1000).muln(1),
      ),
    );

    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    const liqId = await getPoolIdFromEvent(poolEvent);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, secondCurrency],
      liqId,
      swappingAmount,
      feeLockErrors.SwapApprovalFail,
    );
  });

  test("GIVEN user tokens are not enough to pay fee AND X-Y pool is Xyk THEN operation fails", async () => {
    //we need to mint tokens to user which not enough to pay fee
    await Sudo.batchAsSudoFinalized(
      ...(await addTestExtrinsic(
        [firstCurrency, secondCurrency],
        [true, "Xyk"],
        [true, "Xyk"],
        [true, "Xyk"],
      )),
      Assets.mintToken(
        firstCurrency,
        testUser,
        swappingAmount.divn(1000).muln(1),
      ),
    );

    await updateFeeLockMetadata(sudo, null, null, null, [
      [firstCurrency, true],
    ]);
    const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);

    await getSwappingTokenError(
      testUser,
      [firstCurrency, GASP_ASSET_ID],
      liqId,
      swappingAmount,
      feeLockErrors.SwapApprovalFail,
      "Sell",
      true,
    );
  });
});

describe("SingleSell, user has only sold asset and buy GASP", () => {
  test.each(["Xyk", "StableSwap"])(
    "GIVEN sell operation for %s pools AND sale amount > threshold THEN operation operation succeed",
    async (poolType) => {
      const soldAssetAmount = threshold.muln(2);
      await Sudo.batchAsSudoFinalized(
        ...(await addTestExtrinsic(
          [firstCurrency, secondCurrency],
          [true, poolType],
          [true, poolType],
          [true, poolType],
        )),
        Assets.mintToken(firstCurrency, testUser, soldAssetAmount.muln(3)),
      );
      await updateFeeLockMetadata(sudo, null, null, null, [
        [firstCurrency, true],
      ]);
      const liqId = await rpcGetPoolId(firstCurrency, GASP_ASSET_ID);
      await updateFeeLockMetadata(sudo, null, null, null, [
        [firstCurrency, true],
      ]);

      const sellPrice = await rpcCalculateSellPrice(
        liqId,
        firstCurrency,
        soldAssetAmount,
      );

      const userGaspAmountBefore = await getUserAssets(
        testUser.keyRingPair.address,
        [firstCurrency, GASP_ASSET_ID],
      );

      const events = await signTx(
        api,
        Market.sellAsset(liqId, firstCurrency, GASP_ASSET_ID, soldAssetAmount),
        testUser.keyRingPair,
      );
      const filteredEvent = await filterEventData(
        events,
        "market.AssetsSwapped",
      );

      const userGaspAmountAfter = await getUserAssets(
        testUser.keyRingPair.address,
        [firstCurrency, GASP_ASSET_ID],
      );

      expect(userGaspAmountBefore[1].free).bnEqual(BN_ZERO);
      expect(userGaspAmountAfter[1].free).bnEqual(sellPrice);
      expect(
        userGaspAmountBefore[0].free.sub(userGaspAmountAfter[0].free),
      ).bnEqual(soldAssetAmount);
      expect(stringToBN(filteredEvent[0].swaps[0].amountIn)).bnEqual(
        soldAssetAmount.muln(997).divn(1000),
      );
    },
  );
});
