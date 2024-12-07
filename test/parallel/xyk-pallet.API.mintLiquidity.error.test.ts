/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { jest } from "@jest/globals";
import { api, getApi, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  mintLiquidity,
  createPool,
  getLiquidityAssetId,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateUnmodified } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { xykErrors } from "../../utils/utils";
import {
  getEventResultFromMangataTx,
  signSendAndWaitToFinishTx,
} from "../../utils/txHandler";
import { getSudoUser } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(50000);
const defaultCurrencyValue = new BN(250000);

describe("xyk-pallet - Mint liquidity tests: MintLiquidity Errors:", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;
  let thirdCurrency: BN;

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

  test("Mint liquidity when not enough assetY for minting Xamount", async () => {
    //Adding 1000 and 1 more than default. So the user when the pool is created has 1000,1.
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [
        defaultCurrencyValue.add(new BN(1000)),
        defaultCurrencyValue.add(new BN(1)),
      ],
      sudo,
    );
    //lets create a pool with equal balances
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      defaultCurrencyValue,
      secondCurrency,
      defaultCurrencyValue,
    );
    // now we have quite a lot of X and only a few Y, but the pool is 1:1,
    // force the error minting almost all of X
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      testUser1.getAsset(firstCurrency)?.amountBefore.free.sub(new BN(1))!,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
      new BN(defaultCurrencyValue),
      new BN(defaultCurrencyValue),
    ]);
  });
  test("Mint liquidity when not enough assetX for minting Yamount", async () => {
    //Adding 1000 and 1 more than default. So the user when the pool is created has 1000,1.
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [
        defaultCurrencyValue.add(new BN(1)),
        defaultCurrencyValue.add(new BN(1000)),
      ],
      sudo,
    );
    //lets create a pool with equal balances
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      defaultCurrencyValue,
      secondCurrency,
      defaultCurrencyValue,
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    // now we have quite a lot of X and only a few Y, but the pool is 1:1,
    // force the error minting almost all of X
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      testUser1.getAsset(secondCurrency)?.amountBefore.free.sub(new BN(1))!,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });

    await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
      new BN(defaultCurrencyValue),
      new BN(defaultCurrencyValue),
    ]);
  });

  test("Mint liquidity assets that does not belong to any pool", async () => {
    //add two currencies and balance to testUser:
    [firstCurrency, secondCurrency, thirdCurrency] =
      await Assets.setupUserWithCurrencies(
        testUser1,
        [
          defaultCurrencyValue,
          defaultCurrencyValue.add(new BN(1)),
          defaultCurrencyValue,
        ],
        sudo,
      );
    //lets create a pool between asset 1 and 3.
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      firstAssetAmount,
      thirdCurrency,
      secondAssetAmount,
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    //lets try to mint with asset 1 and 2
    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      firstAssetAmount,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
    });

    //lets try to mint with asset 2 and 3
    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      firstAssetAmount,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await validateUnmodified(
      firstCurrency,
      secondCurrency,
      testUser1,
      pool_balance_before,
    );
  });

  test("Mint liquidity more assets than I own", async () => {
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrencyValue, defaultCurrencyValue],
      sudo,
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const poolAmountSecondCurrency = secondAssetAmount.div(new BN(2));
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      firstAssetAmount,
      secondCurrency,
      poolAmountSecondCurrency,
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      testUser1.getAsset(firstCurrency)?.amountBefore.free.add(new BN(1))!,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });

    await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
      firstAssetAmount,
      poolAmountSecondCurrency,
    ]);
    const liqId = await getLiquidityAssetId(secondCurrency, firstCurrency);
    //lets empty the second wallet assets.
    await signSendAndWaitToFinishTx(
      api?.tx.market.multiswapAsset(
        liqId,
        secondCurrency,
        testUser1.getAsset(secondCurrency)?.amountBefore.free!,
        firstCurrency,
        new BN(0),
      ),
      testUser1.keyRingPair,
    );

    const poolBalanceAfterSelling = await getBalanceOfPool(
      firstCurrency,
      secondCurrency,
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      testUser1.getAsset(firstCurrency)?.amountBefore.free.sub(new BN(1))!,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });
    await validateUnmodified(
      firstCurrency,
      secondCurrency,
      testUser1,
      poolBalanceAfterSelling,
    );
  });

  test("Min liquidity, SecondAssetAmount parameter expectation not met", async () => {
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrencyValue, defaultCurrencyValue],
      sudo,
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const poolAmountSecondCurrency = secondAssetAmount.div(new BN(2));
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      firstAssetAmount,
      secondCurrency,
      poolAmountSecondCurrency,
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    //lets test with 1.
    const result = await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      testUser1.getAsset(firstCurrency)?.amountBefore.free.sub(new BN(1))!,
      new BN(1),
    );
    let eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(
      xykErrors.SecondAssetAmountExceededExpectations,
    );
    await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
      firstAssetAmount,
      poolAmountSecondCurrency,
    ]);

    //lets test with 0
    const resultZero = await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      testUser1.getAsset(firstCurrency)?.amountBefore.free.sub(new BN(1))!,
      new BN(0),
    );
    eventResponse = getEventResultFromMangataTx(resultZero);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(
      xykErrors.SecondAssetAmountExceededExpectations,
    );
    await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
      firstAssetAmount,
      poolAmountSecondCurrency,
    ]);

    //lest test with 5000 ( boundary value for unexpected ) the pool was generated with [50000,25000]
    //so we must expect at least 5001 for an amount of 10000

    let resultExpectation = await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(10000),
      new BN(5000),
    );
    eventResponse = getEventResultFromMangataTx(resultExpectation);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual(
      xykErrors.SecondAssetAmountExceededExpectations,
    );
    await validateUnmodified(firstCurrency, secondCurrency, testUser1, [
      firstAssetAmount,
      poolAmountSecondCurrency,
    ]);

    //lets test the boundary value of 5001 ( lowest expectation possible )

    resultExpectation = await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(10000),
      new BN(5001),
    );
    eventResponse = getEventResultFromMangataTx(resultExpectation);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});
