/*
 *
 * @group marketSwap
 */

import { jest } from "@jest/globals";
import { ApiPromise } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { BN } from "ethereumjs-util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import {
  calculateBuyPriceByMarket,
  calculateSellPriceByMarket,
  calculateSellPriceWithImpact,
  getFeeLockMetadata,
} from "../../utils/feeLockHelper";
import { stringToBN } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { Market } from "../../utils/market";
import {
  getLiquidityAssetId,
  getPoolIdFromEvent,
  getTokensAccountInfo,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { signTx } from "gasp-sdk";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;

let api: ApiPromise;
let threshold: BN;

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
    [threshold.muln(20), threshold.muln(20)],
    sudo,
  );
});

test("RPC call calculate SellPrice for Xyk pool correctly", async () => {
  await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(5),
      secondCurrency,
      threshold.muln(5),
    ),
    Assets.mintNative(testUser),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );

  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  const sellPrice = await calculateSellPriceByMarket(
    liqId,
    firstCurrency,
    threshold.muln(2),
  );

  await signTx(
    api,
    Market.sellAsset(liqId, firstCurrency, secondCurrency, threshold.muln(2)),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const tokenAmount = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    secondCurrency,
  );

  expect(stringToBN(tokenAmount.free)).bnEqual(sellPrice);
});

test("Function calculate_sell_price_with_impact makes reliable calculations", async () => {
  await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(5),
      secondCurrency,
      threshold.muln(5),
    ),
    Assets.mintNative(testUser),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );

  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);

  const sellPriceBefore = await calculateSellPriceByMarket(
    liqId,
    firstCurrency,
    threshold.muln(2),
  );

  const sellPriceWithImpact = await calculateSellPriceWithImpact(
    liqId,
    firstCurrency,
    threshold.muln(2),
  );

  await signTx(
    api,
    Market.sellAsset(liqId, firstCurrency, secondCurrency, threshold.muln(2)),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const sellPriceAfter = await calculateSellPriceByMarket(
    liqId,
    firstCurrency,
    threshold.muln(2),
  );

  const diff = sellPriceAfter.sub(sellPriceWithImpact[1]);

  expect(sellPriceBefore).bnEqual(sellPriceWithImpact[0]);
  //we check that the difference between predicted calculation calculate_sell_price_with_impact and calculate_sell_price is less then 0.003%
  expect(diff).bnLt(sellPriceAfter.muln(3).divn(1000));
});

test("RPC call calculate BuyPrice for Stable pool correctly", async () => {
  const poolEvent = await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(5),
      secondCurrency,
      threshold.muln(5),
      "StableSwap",
    ),
    Assets.mintNative(testUser),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );

  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);

  const buyPrice = await calculateBuyPriceByMarket(
    liqId,
    firstCurrency,
    threshold.muln(2),
  );

  //const a = JSON.parse(JSON.stringify(await api.rpc.market.get_pools(null)));
  //const b = a.filter((data: any) => data.assets === firstCurrency.toNumber());
  // expect(b).not.toBeNull();

  const tokenAmountBefore = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );

  await signTx(
    api,
    Market.buyAsset(liqId, firstCurrency, secondCurrency, threshold.muln(2)),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const tokenAmountAfter = await getTokensAccountInfo(
    testUser.keyRingPair.address,
    firstCurrency,
  );

  expect(
    stringToBN(tokenAmountBefore.free).sub(stringToBN(tokenAmountAfter.free)),
  ).bnEqual(buyPrice);
});
