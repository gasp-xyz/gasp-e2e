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
  sellAsset,
  calculate_sell_price_local,
  getTreasury,
  getTreasuryBurn,
  FeeTxs,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateAssetsSwappedEvent,
  validateUnmodified,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars, xykErrors } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { createPool } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const first_asset_amount = new BN(50000);
const second_asset_amount = new BN(50000);
const defaultCurrecyValue = new BN(250000);
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

describe("xyk-pallet - Sell assets tests: SellAsset Errors:", () => {
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
  });

  beforeEach(async () => {
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
  });

  test("Sell assets that does not belong to any pool", async () => {
    //add two curerncies and balance to testUser:
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    const [thirdCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue],
      sudo
    );

    await new FeeTxs()
      .sellAsset(
        testUser1.keyRingPair,
        thirdCurrency,
        secondCurrency,
        first_asset_amount.div(new BN(2)),
        new BN(0)
      )
      .then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
      });

    await new FeeTxs()
      .sellAsset(
        testUser1.keyRingPair,
        secondCurrency,
        thirdCurrency,
        first_asset_amount.div(new BN(2)),
        new BN(0)
      )
      .then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
      });

    await validateUnmodified(
      firstCurrency,
      secondCurrency,
      testUser1,
      pool_balance_before
    );
  });

  test("Try sell more assets than owned", async () => {
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo
    );
    await testUser1.addMGATokens(sudo);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount.div(new BN(2))
    );

    let remainingOfCurrency1 = testUser1
      .getAsset(firstCurrency)
      ?.amountBefore.free!.sub(first_asset_amount)!;
    const sellPriceLocal = calculate_sell_price_local(
      first_asset_amount,
      second_asset_amount.div(new BN(2)),
      remainingOfCurrency1.sub(new BN(1))
    );

    await sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      remainingOfCurrency1.sub(new BN(1)),
      new BN(0)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    remainingOfCurrency1 = testUser1.getAsset(firstCurrency)?.amountAfter.free!;
    expect(remainingOfCurrency1).bnEqual(new BN(1));

    const secondWalletAmount = defaultCurrecyValue
      .add(new BN(1))
      .sub(second_asset_amount.div(new BN(2)))
      .add(sellPriceLocal);

    await sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      remainingOfCurrency1.add(new BN(1)),
      new BN(0)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const diffFromWallet = testUser1
      .getAsset(firstCurrency)
      ?.amountBefore.free!.sub(new BN(defaultCurrecyValue).sub(new BN(1)));
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!
    );

    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      secondWalletAmount
    );

    const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);

    // the user only has 1 asset of X -> pool must have : 250k -1
    // the user has "secondWalletAmount", so the remaining must be in the pool.
    // Using Stano formulas, doing a Tx of 199999 - 0.05% = 199899.0005 ~ 199899 - 100 buy. Same for burn.
    // so fee is 100 + 100.
    const fee = new BN(200);
    const secondWalletInThePool = defaultCurrecyValue
      .add(new BN(1))
      .sub(secondWalletAmount);
    const expectedPoolValueFirstAsset = new BN(249999).sub(fee);
    const expectedPoolValueSecondAsset = secondWalletInThePool;
    expect(expectedPoolValueFirstAsset).bnEqual(pool_balance[0]);
    expect(expectedPoolValueSecondAsset).bnEqual(pool_balance[1]);

    //lets get the treasure amounts! Now the amounts are discounted from the first currency! ( sold asset )
    const treasurySecondCurrency = await getTreasury(secondCurrency);
    const treasuryFirstCurrency = await getTreasury(firstCurrency);
    const treasuryBurnSecondCurrency = await getTreasuryBurn(secondCurrency);
    const treasuryBurnFirstCurrency = await getTreasuryBurn(firstCurrency);
    expect(treasurySecondCurrency).bnEqual(new BN(0));
    expect(treasuryBurnSecondCurrency).bnEqual(new BN(0));
    expect([treasuryFirstCurrency, treasuryBurnFirstCurrency]).toEqual([
      new BN(100),
      new BN(100),
    ]);
  });

  test("Sell assets with a high expectation: limit +1", async () => {
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo
    );
    await testUser1.addMGATokens(sudo);
    const secondAssetAmount = second_asset_amount.div(new BN(2));
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      secondAssetAmount
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const remainingOfCurrency1 =
      testUser1.getAsset(firstCurrency)?.amountBefore!;

    const sellPriceLocal = calculate_sell_price_local(
      first_asset_amount,
      secondAssetAmount,
      remainingOfCurrency1.free
    );
    await sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      remainingOfCurrency1.free,
      sellPriceLocal.add(new BN(1))
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "SellAssetFailedDueToSlippage",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    //fee: 603 ??  //TODO: validate with Stano.
    const feeToAvoidFrontRunning = new BN(603);
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const diffFromWallet = testUser1
      .getAsset(firstCurrency)
      ?.amountBefore.free!.sub(feeToAvoidFrontRunning);
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!
    );

    //second wallet should not be modified.
    const amount = testUser1.getAsset(secondCurrency)?.amountBefore!;
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      amount.free
    );

    const treasury = await getTreasury(firstCurrency);
    const treasuryBurn = await getTreasuryBurn(firstCurrency);
    expect(treasury).bnEqual(new BN(101));
    expect(treasuryBurn).bnEqual(new BN(101));
    //TODO: validate with Stano.
    const increasedInPool = new BN(401);
    const poolBalances = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect(poolBalances[0]).bnEqual(first_asset_amount.add(increasedInPool));
    expect(poolBalances[1]).bnEqual(secondAssetAmount);
  });
});

describe("xyk-pallet - Sell assets tests: Selling Assets you can", () => {
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
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
  });

  test("Sell assets with a high expectation: limit - OK", async () => {
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo
    );
    await testUser1.addMGATokens(sudo);
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount.div(new BN(2))
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const remainingOfCurrency1 =
      testUser1.getAsset(firstCurrency)?.amountBefore!;

    const sellPriceLocal = calculate_sell_price_local(
      first_asset_amount,
      second_asset_amount.div(new BN(2)),
      remainingOfCurrency1.free
    );
    await sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      remainingOfCurrency1.free,
      sellPriceLocal
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      validateAssetsSwappedEvent(
        eventResponse,
        testUser1.keyRingPair.address,
        firstCurrency,
        remainingOfCurrency1.free,
        secondCurrency,
        sellPriceLocal
      );
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    //spent all the money!

    const amount = new BN(0);
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      amount
    );
    //amounAsset2 = issued  - spent in the pool + bought selling all firstCurerncy.
    const amountAsset2 = defaultCurrecyValue
      .add(new BN(1))
      .sub(second_asset_amount.div(new BN(2)))
      .add(sellPriceLocal);

    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      amountAsset2
    );
  });

  test("Sell assets from a wallet I own into a wallet I do not own: limit", async () => {
    // setup users
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo
    );
    const [thirdCurrency] = await Assets.setupUserWithCurrencies(
      testUser2,
      [defaultCurrecyValue],
      sudo
    );

    await sudo.mint(thirdCurrency, testUser1, new BN(10000));
    await testUser1.addMGATokens(sudo);
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount.div(new BN(2))
    );

    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      new BN(10000),
      thirdCurrency,
      new BN(10000).div(new BN(2))
    );

    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    const remainingOfCurrency3 =
      testUser2.getAsset(thirdCurrency)?.amountBefore!;

    const sellPriceLocal = calculate_sell_price_local(
      new BN(10000).div(new BN(2)),
      new BN(10000),
      remainingOfCurrency3.free
    );

    await new FeeTxs()
      .sellAsset(
        testUser2.keyRingPair,
        thirdCurrency,
        firstCurrency,
        remainingOfCurrency3.free,
        sellPriceLocal
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
          remainingOfCurrency3.free,
          firstCurrency,
          sellPriceLocal
        );
      });
    testUser2.addAsset(firstCurrency);
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    let amount = new BN(0);
    expect(testUser2.getAsset(thirdCurrency)?.amountAfter.free!).bnEqual(
      amount
    );

    amount = sellPriceLocal;
    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      amount
    );
  });
});
