/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  getTreasury,
  getTreasuryBurn,
  calculate_buy_price_local,
  buyAsset,
  calculate_buy_price_rpc,
  FeeTxs,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateAssetsSwappedEvent,
  validateUnmodified,
  validateUserPaidFeeForFailedTx,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { createPool } from "../../utils/tx";
import { calculateFees, feeLockErrors, xykErrors } from "../../utils/utils";
import { getSudoUser } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(25000);
const defaultCurrencyValue = new BN(250000);

let testUser1: User;
let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;

const pool_balance_before = [new BN(0), new BN(0)];

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "ethereum" });

  // setup users
  testUser1 = new User(keyring);

  sudo = getSudoUser();

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);

  await testUser1.addGASPTokens(sudo);
});

describe("xyk-pallet - Buy assets tests: BuyAssets Errors:", () => {
  beforeEach(async () => {
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrencyValue, defaultCurrencyValue.add(new BN(1))],
      sudo,
    );

    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      firstAssetAmount,
      secondCurrency,
      secondAssetAmount,
    );
  });
  test("Buy assets that does not belong to any pool", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    const [thirdCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrencyValue],
      sudo,
    );
    let exception = false;
    let errorMessage = "";
    try {
      await new FeeTxs()
        .buyAsset(
          testUser1.keyRingPair,
          thirdCurrency,
          secondCurrency,
          firstAssetAmount.div(new BN(2)),
          new BN(0),
        )
        .then((result) => {
          const eventResponse = getEventResultFromMangataTx(result);
          expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
          expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
        });
    } catch (e) {
      exception = true;
      //@ts-ignore
      errorMessage = e.data;
    }
    expect(exception).toBeTruthy();
    expect(errorMessage).toEqual(feeLockErrors.SwapApprovalFail);

    exception = false;
    errorMessage = "";
    try {
      await new FeeTxs()
        .buyAsset(
          testUser1.keyRingPair,
          secondCurrency,
          thirdCurrency,
          firstAssetAmount.div(new BN(2)),
          new BN(0),
        )
        .then((result) => {
          const eventResponse = getEventResultFromMangataTx(result);
          expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
          expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
        });
    } catch (e) {
      exception = true;
      //@ts-ignore
      errorMessage = e.data;
    }
    expect(exception).toBeTruthy();
    expect(errorMessage).toEqual(feeLockErrors.SwapApprovalFail);

    await validateUnmodified(
      thirdCurrency,
      secondCurrency,
      testUser1,
      pool_balance_before,
    );
  });

  test("Buy more assets than exists in the pool", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await buyAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      secondAssetAmount.add(new BN(1)),
      new BN(1000000),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.ExcessiveInputAmount);
    });
    // https://mangatafinance.atlassian.net/browse/GASP-1872
    // await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
    //  firstAssetAmount,
    //  secondAssetAmount,
    //]);
  });

  test("Buy all assets from the the pool", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const poolBalanceBefore = await getBalanceOfPool(
      firstCurrency,
      secondCurrency,
    );
    let error = false;
    let errorMessage = "";
    try {
      await buyAsset(
        testUser1.keyRingPair,
        firstCurrency,
        secondCurrency,
        secondAssetAmount,
        new BN(100000000),
      ).then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(eventResponse.data).toEqual(xykErrors.ExcessiveInputAmount);
      });
    } catch (e) {
      error = true;
      //@ts-ignore
      errorMessage = e.data;
    }
    expect(error).toBeTruthy();
    expect(errorMessage).toEqual(feeLockErrors.SwapApprovalFail);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
      poolBalanceBefore[0],
      poolBalanceBefore[1],
    ]);
  });

  test("Buy assets with a high expectation: maxInput -1", async () => {
    const poolBalanceBefore = await getBalanceOfPool(
      firstCurrency,
      secondCurrency,
    );
    const buyPriceLocal = await calculate_buy_price_rpc(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      secondAssetAmount.sub(new BN(1)),
    );
    await sudo.mint(firstCurrency, testUser1, new BN(buyPriceLocal));
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await buyAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      secondAssetAmount.sub(new BN(1)),
      buyPriceLocal.sub(new BN(1)),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.ExcessiveInputAmount);
    });

    await validateUserPaidFeeForFailedTx(
      buyPriceLocal,
      testUser1,
      firstCurrency,
      secondCurrency,
      secondAssetAmount,
      firstAssetAmount,
    );
  });
});

describe("xyk-pallet - Buy assets tests: Buying assets you can", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

  //creating pool

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    keyring = new Keyring({ type: "ethereum" });

    // setup users
    testUser1 = new User(keyring);

    sudo = getSudoUser();

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
    await testUser1.addGASPTokens(sudo);
  });

  test("Leave only one asset in the pool", async () => {
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrencyValue, defaultCurrencyValue.add(new BN(1))],
      sudo,
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      firstAssetAmount,
      secondCurrency,
      secondAssetAmount,
    );

    const buyPriceLocal = await calculate_buy_price_rpc(
      firstAssetAmount,
      secondAssetAmount,
      secondAssetAmount.sub(new BN(1)),
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await sudo.mint(firstCurrency, testUser1, new BN(buyPriceLocal));

    await buyAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      secondAssetAmount.sub(new BN(1)),
      buyPriceLocal.add(new BN(1)),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(buyPriceLocal);
    const fee = treasury.add(treasuryBurn);
    const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect([
      buyPriceLocal.add(firstAssetAmount).sub(fee),
      new BN(1),
    ]).collectionBnEqual(pool_balance);

    let amount = secondAssetAmount.sub(new BN(1));
    const addFromWallet = testUser1
      .getAsset(secondCurrency)
      ?.amountBefore.free!.add(amount);
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      addFromWallet!,
    );

    amount = testUser1.getAsset(firstCurrency)?.amountBefore.free!;
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      amount,
    );

    //lets get the treasure amounts!
    const treasurySecondCurrency = await getTreasury(secondCurrency);
    const treasuryFirstCurrency = await getTreasury(firstCurrency);
    const treasuryBurnSecondCurrency = await getTreasuryBurn(secondCurrency);
    const treasuryBurnFirstCurrency = await getTreasuryBurn(firstCurrency);

    expect([
      treasurySecondCurrency,
      treasuryBurnSecondCurrency,
    ]).collectionBnEqual([new BN(0), new BN(0)]);
    expect([
      treasuryFirstCurrency,
      treasuryBurnFirstCurrency,
    ]).collectionBnEqual([treasury, treasuryBurn]);
  });

  test("Buy from a wallet I own into a wallet I do not own", async () => {
    const thirdAssetAmount = new BN(10000);
    const amountToBuy = new BN(2000);
    // setup users
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrencyValue, defaultCurrencyValue.add(new BN(1))],
      sudo,
    );
    const [thirdCurrency] = await Assets.setupUserWithCurrencies(
      testUser2,
      [defaultCurrencyValue],
      sudo,
    );

    await sudo.mint(thirdCurrency, testUser1, thirdAssetAmount);
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      firstAssetAmount,
      secondCurrency,
      secondAssetAmount,
    );
    // create a pool between First and Third, P(thirdAssetAmount, thirdAssetAmount/2)
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      thirdAssetAmount,
      thirdCurrency,
      thirdAssetAmount.div(new BN(2)),
    );
    const poolBalanceBefore = await getBalanceOfPool(
      firstCurrency,
      thirdCurrency,
    );

    await testUser2.refreshAmounts(AssetWallet.BEFORE);

    const buyPriceLocal = calculate_buy_price_local(
      thirdAssetAmount.div(new BN(2)),
      thirdAssetAmount,
      amountToBuy,
    );

    await new FeeTxs()
      .buyAsset(
        testUser2.keyRingPair,
        thirdCurrency,
        firstCurrency,
        amountToBuy,
        buyPriceLocal.addn(1),
      )
      .then((result) => {
        const eventResponse = getEventResultFromMangataTx(result, [
          "xyk",
          "AssetsSwapped",
          testUser2.keyRingPair.address,
        ]);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        validateAssetsSwappedEvent(
          eventResponse,
          testUser2.keyRingPair.address,
          thirdCurrency,
          buyPriceLocal,
          firstCurrency,
          amountToBuy,
        );
      });

    testUser2.addAsset(firstCurrency);
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    const diffFromWallet = testUser2
      .getAsset(thirdCurrency)
      ?.amountBefore.free!.sub(buyPriceLocal);

    expect(testUser2.getAsset(thirdCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      amountToBuy,
    );

    const poolBalanceAfter = await getBalanceOfPool(
      firstCurrency,
      thirdCurrency,
    );
    const { treasury, treasuryBurn } = calculateFees(buyPriceLocal);
    const fee = treasury.add(treasuryBurn);
    expect([
      poolBalanceBefore[0].sub(amountToBuy),
      poolBalanceBefore[1].add(buyPriceLocal).sub(fee),
    ]).collectionBnEqual(poolBalanceAfter);
  });
});
