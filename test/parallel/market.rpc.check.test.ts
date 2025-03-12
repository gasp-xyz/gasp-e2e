/*
 *
 * @group marketSwap
 */

import { jest } from "@jest/globals";
import { ApiPromise } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { AssetWallet, User } from "../../utils/User";
import { BN } from "ethereumjs-util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import {
  calculateBuyPriceByMarket,
  calculateBuyPriceWithImpact,
  calculateSellPriceByMarket,
  calculateSellPriceWithImpact,
  getFeeLockMetadata,
} from "../../utils/feeLockHelper";
import { stringToBN } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import {
  calculateExpectedLiquidityMinted,
  getBurnAmount,
  getTradeableTokens,
  Market,
} from "../../utils/market";
import {
  getLiquidityAssetId,
  getPoolIdFromEvent,
  getTokensAccountInfo,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { signTx } from "gasp-sdk";
import {
  ExtrinsicResult,
  filterAndStringifyFirstEvent,
} from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;

let api: ApiPromise;
let threshold: BN;
let liqId: BN;

let firstCurrency: BN;
let secondCurrency: BN;

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
    [threshold.muln(100), threshold.muln(100)],
    sudo,
  );
});

describe.each(["Xyk", "StableSwap"])(
  "Check RPC calculate methods for % pools",
  (poolType) => {
    beforeEach(async () => {
      const poolEvent = await Sudo.batchAsSudoFinalized(
        Market.createPool(
          firstCurrency,
          threshold.muln(10),
          secondCurrency,
          threshold.muln(5),
          poolType,
        ),
        Assets.mintNative(testUser),
        Assets.mintToken(firstCurrency, testUser, threshold.muln(20)),
      );

      await updateFeeLockMetadata(sudo, null, null, null, [
        [firstCurrency, true],
      ]);

      if (poolType === "StableSwap") {
        liqId = await getPoolIdFromEvent(poolEvent);
      } else {
        liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
      }
    });

    test("Function calculate_sell_price works correctly", async () => {
      const sellPrice = await calculateSellPriceByMarket(
        liqId,
        firstCurrency,
        threshold.muln(2),
      );

      //we create reverse calculation to check that we receive another value
      const sellPriceReverse = await calculateSellPriceByMarket(
        liqId,
        secondCurrency,
        threshold.muln(2),
      );

      await signTx(
        api,
        Market.sellAsset(
          liqId,
          firstCurrency,
          secondCurrency,
          threshold.muln(2),
        ),
        testUser.keyRingPair,
      ).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const tokenAmount = await getTokensAccountInfo(
        testUser.keyRingPair.address,
        secondCurrency,
      );

      expect(sellPrice).not.bnEqual(sellPriceReverse);
      expect(stringToBN(tokenAmount.free)).bnEqual(sellPrice);
    });

    test("Function calculate_sell_price_with_impact makes reliable calculations", async () => {
      const sellPriceBefore = await calculateSellPriceByMarket(
        liqId,
        firstCurrency,
        threshold,
      );

      const sellPriceWithImpact = await calculateSellPriceWithImpact(
        liqId,
        firstCurrency,
        threshold,
      );

      await signTx(
        api,
        Market.sellAsset(liqId, firstCurrency, secondCurrency, threshold),
        testUser.keyRingPair,
      ).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const sellPriceAfter = await calculateSellPriceByMarket(
        liqId,
        firstCurrency,
        threshold,
      );

      const diff = sellPriceAfter.sub(sellPriceWithImpact[1]);

      expect(sellPriceBefore).bnEqual(sellPriceWithImpact[0]);
      expect(diff).bnLt(sellPriceAfter.muln(3).divn(1000));
    });

    test("Function calculate_buy_price works correctly", async () => {
      const buyPrice = await calculateBuyPriceByMarket(
        liqId,
        secondCurrency,
        threshold.muln(2),
      );

      //const a = JSON.parse(JSON.stringify(await api.rpc.market.get_pools(null)));
      //const b = a.filter((data: any) => data.assets === firstCurrency.toNumber());
      // expect(b).not.toBeNull();

      const buyPriceReverse = await calculateSellPriceByMarket(
        liqId,
        firstCurrency,
        threshold.muln(2),
      );

      const tokenAmountBefore = await getTokensAccountInfo(
        testUser.keyRingPair.address,
        firstCurrency,
      );

      await signTx(
        api,
        Market.buyAsset(
          liqId,
          firstCurrency,
          secondCurrency,
          threshold.muln(2),
        ),
        testUser.keyRingPair,
      ).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const tokenAmountAfter = await getTokensAccountInfo(
        testUser.keyRingPair.address,
        firstCurrency,
      );

      expect(buyPrice).not.bnEqual(buyPriceReverse);
      expect(
        stringToBN(tokenAmountBefore.free).sub(
          stringToBN(tokenAmountAfter.free),
        ),
      ).bnEqual(buyPrice);
    });

    test("Function calculate_buy_price_with_impact makes reliable calculations", async () => {
      const buyPriceBefore = await calculateBuyPriceByMarket(
        liqId,
        firstCurrency,
        threshold.muln(2),
      );

      const buyPriceWithImpact = await calculateBuyPriceWithImpact(
        liqId,
        firstCurrency,
        threshold.muln(2),
      );

      await signTx(
        api,
        Market.buyAsset(
          liqId,
          firstCurrency,
          secondCurrency,
          threshold.muln(2),
        ),
        testUser.keyRingPair,
      ).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const buyPriceAfter = await calculateBuyPriceByMarket(
        liqId,
        firstCurrency,
        threshold.muln(2),
      );

      const diff = buyPriceAfter.sub(buyPriceWithImpact[1]);

      expect(buyPriceBefore).bnEqual(buyPriceWithImpact[0]);
      expect(diff).bnLt(buyPriceAfter.muln(3).divn(1000));
    });
  },
);

test("check get_burn_amount", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(20)),
    Assets.mintToken(secondCurrency, testUser, threshold.muln(20)),
  );

  await signTx(
    api,
    Market.createPool(
      firstCurrency,
      threshold.muln(10),
      secondCurrency,
      threshold.muln(5),
    ),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  testUser.addAsset(firstCurrency);
  testUser.addAsset(secondCurrency);
  const burnAmount = await getBurnAmount(liqId, threshold);

  liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await signTx(
    api,
    Market.burnLiquidity(liqId, threshold),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const firstCurrencyDiff: any = testUser
    .getAsset(firstCurrency)
    ?.amountAfter.free.sub(
      testUser.getAsset(firstCurrency)?.amountBefore.free!,
    );

  const secondCurrencyDiff: any = testUser
    .getAsset(secondCurrency)
    ?.amountAfter.free.sub(
      testUser.getAsset(secondCurrency)?.amountBefore.free!,
    );

  expect(burnAmount.firstTokenAmount).bnEqual(firstCurrencyDiff);
  expect(burnAmount.secondTokenAmount).bnEqual(secondCurrencyDiff);
});

test("check calculation for minting", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(20)),
    Assets.mintToken(secondCurrency, testUser, threshold.muln(20)),
  );

  await signTx(
    api,
    Market.createPool(
      firstCurrency,
      threshold.muln(10),
      secondCurrency,
      threshold.muln(5),
    ),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  testUser.addAsset(liqId);
  await testUser.refreshAmounts(AssetWallet.BEFORE);

  const calculationData = await calculateExpectedLiquidityMinted(
    liqId,
    firstCurrency,
    threshold,
  );

  const events = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser,
      Market.mintLiquidity(
        liqId,
        firstCurrency,
        threshold,
        calculationData.expectedSecondAmount,
      ),
    ),
  );
  const eventResponse = getEventResultFromMangataTx(events);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const mintingLpEvent = filterAndStringifyFirstEvent(
    events,
    "LiquidityMinted",
  );

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const diff: any = testUser
    .getAsset(liqId)
    ?.amountAfter.free.sub(testUser.getAsset(liqId)?.amountBefore.free!);
  expect(stringToBN(mintingLpEvent[4])).bnEqual(
    calculationData.expectedSecondAmount,
  );
  expect(diff).bnEqual(calculationData.expectedLiquidity);
});

test("check get_tradeable_token", async () => {
  const tokensListBefore = await getTradeableTokens();

  await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(10),
      secondCurrency,
      threshold.muln(5),
    ),
    Assets.mintNative(testUser),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(20)),
  );

  liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  const tokensListAfter = await getTradeableTokens();

  const listBeforeFiltered = tokensListBefore.filter(
    (data: any) => data.tokenId === liqId.toNumber(),
  );
  const listAfterFiltered = tokensListAfter.filter(
    (data: any) => data.tokenId === liqId.toNumber(),
  );
  expect(listAfterFiltered[0].tokenId).toEqual(liqId.toNumber());
  expect(listBeforeFiltered[0]).toBeUndefined();
});
