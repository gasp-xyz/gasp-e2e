import { jest } from "@jest/globals";
import { BN } from "ethereumjs-util";
import { User } from "../../utils/User";
import { getApi, initApi } from "../../utils/api";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Market } from "../../utils/market";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  calculate_sell_price_local,
  getBalanceOfPool,
  getLiquidityAssetId,
  getPoolIdFromEvent,
  updateFeeLockMetadata,
} from "../../utils/tx";
import { feeLockErrors, stringToBN } from "../../utils/utils";
import { ApiPromise } from "@polkadot/api";
import { signTx } from "gasp-sdk";
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

test("When user has only sold asset AND all pools are StableSwap AND amount > threshold THEN operation failed", async () => {
  let error: any;

  const poolEvent = await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(5),
      secondCurrency,
      threshold.muln(5),
      "StableSwap",
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(5),
      firstCurrency,
      threshold.muln(5),
      "StableSwap",
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(5),
      secondCurrency,
      threshold.muln(5),
      "StableSwap",
    ),
  );

  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );

  const liqId = await getPoolIdFromEvent(poolEvent);

  try {
    await signTx(
      api,
      Market.sellAsset(
        liqId,
        firstCurrency,
        secondCurrency,
        threshold.add(threshold.divn(2)),
      ),
      testUser.keyRingPair,
    );
  } catch (e) {
    error = e;
  }
  expect(error.data).toEqual(feeLockErrors.FeeLockFail);
});

test("When user has only sold asset AND X-Y pool is StableSwap AND amount > threshold THEN operation failed", async () => {
  const poolEvent = await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(5),
      secondCurrency,
      threshold.muln(5),
      "StableSwap",
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(5),
      firstCurrency,
      threshold.muln(5),
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(5),
      secondCurrency,
      threshold.muln(5),
    ),
    Assets.mintToken(firstCurrency, testUser, threshold.muln(5)),
  );

  await updateFeeLockMetadata(sudo, null, null, null, [[firstCurrency, true]]);

  const liqId = await getPoolIdFromEvent(poolEvent);

  //const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);

  // const sellPrice = calculate_sell_price_local(
  //   poolBalance[0],
  //   poolBalance[1],
  //   threshold.add(threshold.divn(2)),
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
});

test("When user has only sold asset AND all pools are Xyk AND amount > threshold THEN operation succeed", async () => {
  await Sudo.batchAsSudoFinalized(
    Market.createPool(
      firstCurrency,
      threshold.muln(2),
      secondCurrency,
      threshold.muln(2),
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(2),
      firstCurrency,
      threshold.muln(2),
    ),
    Market.createPool(
      GASP_ASSET_ID,
      threshold.muln(2),
      secondCurrency,
      threshold.muln(2),
    ),
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

  expect(tokenValue.free).bnEqual(sellPrice);
});
