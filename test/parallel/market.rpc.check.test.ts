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
  rpcCalculateBuyPrice,
  rpcCalculateBuyPriceWithImpact,
  rpcCalculateSellPrice,
  rpcCalculateSellPriceWithImpact,
} from "../../utils/feeLockHelper";
import { stringToBN } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import {
  Market,
  rpcCalculateExpectedLiquidityMinted,
  rpcGetBurnAmount,
  rpcGetPoolId,
  rpcGetPoolsForTrading,
  rpcGetTradeableTokens,
} from "../../utils/market";
import {
  calculate_buy_price_rpc,
  calculate_sell_price_rpc,
  getBalanceOfPool,
  getTokensAccountInfo,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { BN_HUNDRED_MILLIONS, BN_MILLION, signTx } from "gasp-sdk";
import {
  ExtrinsicResult,
  filterAndStringifyFirstEvent,
} from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let api: ApiPromise;
let testUser: User;
let sudo: User;
let firstCurrency: BN;
let secondCurrency: BN;
let liqId: BN;

async function createPoolAndGetLiqId(
  user: User,
  firstAsset: BN,
  secondAsset: BN,
  poolType = "Xyk",
) {
  await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstAsset,
      BN_MILLION.muln(10),
      secondAsset,
      BN_MILLION.muln(5),
      poolType,
    ),
    Assets.mintNative(user),
    Assets.mintToken(firstAsset, user, BN_MILLION.muln(20)),
  );

  await updateFeeLockMetadata(sudo, null, null, null, [[firstAsset, true]]);

  return await rpcGetPoolId(firstAsset, secondAsset);
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
    [BN_HUNDRED_MILLIONS, BN_HUNDRED_MILLIONS],
    sudo,
  );
});

describe.each(["Xyk", "StableSwap"])(
  "Check RPC calculate methods for %s pool",
  (poolType) => {
    beforeEach(async () => {
      liqId = await createPoolAndGetLiqId(
        testUser,
        firstCurrency,
        secondCurrency,
        poolType,
      );
    });

    test("Function rpcCalculateSellPrice works correctly", async () => {
      let sellPriceRetro: BN;

      const sellPrice = await rpcCalculateSellPrice(
        liqId,
        firstCurrency,
        BN_MILLION.muln(2),
      );

      if (poolType === "Xyk") {
        const poolBalance = await getBalanceOfPool(
          firstCurrency,
          secondCurrency,
        );
        sellPriceRetro = await calculate_sell_price_rpc(
          poolBalance[0],
          poolBalance[1],
          BN_MILLION.muln(2),
        );
      } else {
        sellPriceRetro = sellPrice;
      }

      //we create reverse calculation to check that we receive another value
      const sellPriceReverse = await rpcCalculateSellPrice(
        liqId,
        secondCurrency,
        BN_MILLION.muln(2),
      );

      await signTx(
        api,
        Market.sellAsset(
          liqId,
          firstCurrency,
          secondCurrency,
          BN_MILLION.muln(2),
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

      expect(sellPrice).bnEqual(sellPriceRetro);
      expect(sellPrice).not.bnEqual(sellPriceReverse);
      expect(stringToBN(tokenAmount.free)).bnEqual(sellPrice);
    });

    test("Function rpcCalculateSellPriceWithImpact makes reliable calculations", async () => {
      const sellPriceBefore = await rpcCalculateSellPrice(
        liqId,
        firstCurrency,
        BN_MILLION,
      );

      const sellPriceWithImpact = await rpcCalculateSellPriceWithImpact(
        liqId,
        firstCurrency,
        BN_MILLION,
      );

      await signTx(
        api,
        Market.sellAsset(liqId, firstCurrency, secondCurrency, BN_MILLION),
        testUser.keyRingPair,
      ).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const sellPriceAfter = await rpcCalculateSellPrice(
        liqId,
        firstCurrency,
        BN_MILLION,
      );

      const diff = sellPriceAfter.sub(sellPriceWithImpact.secondIteration);

      expect(sellPriceBefore).bnEqual(sellPriceWithImpact.firstIteration);
      expect(diff).bnLt(sellPriceAfter.muln(3).divn(1000));
    });

    test.only("Function rpcCalculateBuyPrice works correctly", async () => {
      let buyPriceRetro: BN;

      const buyPrice = await rpcCalculateBuyPrice(
        liqId,
        secondCurrency,
        BN_MILLION.divn(4),
      );

      if (poolType === "Xyk") {
        const poolBalance = await getBalanceOfPool(
          firstCurrency,
          secondCurrency,
        );
        buyPriceRetro = await calculate_buy_price_rpc(
          poolBalance[0],
          poolBalance[1],
          BN_MILLION.divn(4),
        );
      } else {
        buyPriceRetro = buyPrice;
      }

      const buyPriceReverse = await rpcCalculateBuyPrice(
        liqId,
        firstCurrency,
        BN_MILLION.divn(4),
      );

      const tokenAmountBefore = await getTokensAccountInfo(
        testUser.keyRingPair.address,
        firstCurrency,
      );

      await signTx(
        api,
        await Market.buyAsset(
          liqId,
          firstCurrency,
          secondCurrency,
          BN_MILLION.divn(4),
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

      expect(buyPrice).bnEqual(buyPriceRetro);
      expect(buyPrice).not.bnEqual(buyPriceReverse);
      expect(
        stringToBN(tokenAmountBefore.free).sub(
          stringToBN(tokenAmountAfter.free),
        ),
      ).bnEqual(buyPrice);
    });

    test("Function rpcCalculateBuyPriceWithImpact makes reliable calculations", async () => {
      const buyPriceBefore = await rpcCalculateBuyPrice(
        liqId,
        firstCurrency,
        BN_MILLION.divn(4),
      );

      const buyPriceWithImpact = await rpcCalculateBuyPriceWithImpact(
        liqId,
        firstCurrency,
        BN_MILLION.divn(4),
      );

      await signTx(
        api,
        await Market.buyAsset(
          liqId,
          firstCurrency,
          secondCurrency,
          BN_MILLION.divn(4),
        ),
        testUser.keyRingPair,
      ).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const buyPriceAfter = await rpcCalculateBuyPrice(
        liqId,
        firstCurrency,
        BN_MILLION.divn(4),
      );

      const diff = buyPriceAfter.sub(buyPriceWithImpact.secondIteration);

      expect(buyPriceBefore).bnEqual(buyPriceWithImpact.firstIteration);
      expect(diff).bnLt(buyPriceAfter.muln(3).divn(1000));
    });
  },
);

describe("Market - rpc", () => {
  beforeEach(async () => {
    liqId = await createPoolAndGetLiqId(
      testUser,
      firstCurrency,
      secondCurrency,
    );

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(secondCurrency, testUser, BN_MILLION.muln(20)),
    );

    testUser.addAsset(firstCurrency);
    testUser.addAsset(secondCurrency);
  });
  test("rpcGetBurnAmount test", async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser,
        Market.mintLiquidity(liqId, firstCurrency, BN_MILLION.muln(2)),
      ),
    );

    const burnAmount = await rpcGetBurnAmount(liqId, BN_MILLION);

    await testUser.refreshAmounts(AssetWallet.BEFORE);

    await signTx(
      api,
      Market.burnLiquidity(liqId, BN_MILLION),
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

    expect(burnAmount.firstAssetAmount).bnEqual(firstCurrencyDiff);
    expect(burnAmount.secondAssetAmount).bnEqual(secondCurrencyDiff);
  });

  test("rpcCalculateExpectedLiquidityMinted test", async () => {
    testUser.addAsset(liqId);
    await testUser.refreshAmounts(AssetWallet.BEFORE);

    const calculationData = await rpcCalculateExpectedLiquidityMinted(
      liqId,
      firstCurrency,
      BN_MILLION,
    );

    const events = await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser,
        Market.mintLiquidity(
          liqId,
          firstCurrency,
          BN_MILLION,
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
});

test("Market - rpc rpcGetPoolsForTrading test", async () => {
  const poolsListBefore = await rpcGetPoolsForTrading();

  liqId = await createPoolAndGetLiqId(testUser, firstCurrency, secondCurrency);

  const poolsListAfter = await rpcGetPoolsForTrading();

  const listBeforeFiltered = poolsListBefore.filter(
    (data: any) => data === liqId.toNumber(),
  );
  const listAfterFiltered = poolsListAfter.filter(
    (data: any) => data === liqId.toNumber(),
  );
  expect(listAfterFiltered[0]).toEqual(liqId.toNumber());
  expect(listBeforeFiltered[0]).toBeUndefined();
});

test("Market - rpc rpcGetTradeableTokens test", async () => {
  const tokensListBefore = await rpcGetTradeableTokens();

  liqId = await createPoolAndGetLiqId(testUser, firstCurrency, secondCurrency);

  const tokensListAfter = await rpcGetTradeableTokens();

  const listBeforeFiltered = tokensListBefore.filter(
    (data: any) => data.tokenId === liqId.toNumber(),
  );
  const listAfterFiltered = tokensListAfter.filter(
    (data: any) => data.tokenId === liqId.toNumber(),
  );
  expect(listAfterFiltered[0].tokenId).toEqual(liqId.toNumber());
  expect(listBeforeFiltered[0]).toBeUndefined();
});
