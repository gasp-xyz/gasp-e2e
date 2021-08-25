/*
 * @group parallel
 * @group api
 *
 */

import { api, getApi, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  getLiquidityAssetId,
  burnLiquidity,
  calculate_buy_price_local,
  getLiquidityPool,
} from "../../utils/tx";
import {
  waitNewBlock,
  ExtrinsicResult,
  EventResult,
} from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateMintedLiquidityEvent,
  validateTreasuryAmountsEqual,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  getEventResultFromTxWait,
  signSendAndWaitToFinishTx,
} from "../../utils/txHandler";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const defaultCurrecyValue = 250000;

describe("xyk-pallet - Burn liquidity tests: when burning liquidity you can", () => {
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
    await waitNewBlock();
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
  });

  test("Get affected after a transaction that devaluates X wallet & destroy the pool", async () => {
    const assetXamount = new BN(1000);
    const assetYamount = new BN(10);
    //create a new user
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [assetXamount, assetYamount],
      sudo
    );
    await testUser1.addMGATokens(sudo);
    //lets create a pool with equal balances
    await signSendAndWaitToFinishTx(
      api?.tx.xyk.createPool(
        firstCurrency,
        new BN(assetXamount),
        secondCurrency,
        new BN(assetYamount)
      ),
      testUser1.keyRingPair
    );
    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency
    );
    const liquidityPoolBeforeDestroy = await getLiquidityPool(liquidityAssetId);

    await testUser2.addMGATokens(sudo);
    const amountOfX = calculate_buy_price_local(
      new BN(assetXamount),
      new BN(assetYamount),
      new BN(9)
    );
    await sudo.mint(firstCurrency, testUser2, amountOfX);
    await testUser2.buyAssets(
      firstCurrency,
      secondCurrency,
      new BN(9),
      amountOfX.add(new BN(1))
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(assetXamount.add(assetYamount))
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "LiquidityBurned",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    expect(liqId).bnEqual(new BN(-1));
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    testUser1.validateWalletEquals(
      firstCurrency,
      amountOfX.add(new BN(assetXamount))
    );
    testUser1.validateWalletEquals(secondCurrency, new BN(1));

    expect([new BN(0), new BN(0)]).toEqual(poolBalance);

    //Validate liquidity pool is destroyed.
    const liquidityPool = await getLiquidityPool(liquidityAssetId);
    expect(liquidityPool[0]).bnEqual(new BN(-1));
    expect(liquidityPool[1]).bnEqual(new BN(-1));

    expect(liquidityPoolBeforeDestroy[0]).bnEqual(firstCurrency);
    expect(liquidityPoolBeforeDestroy[1]).bnEqual(secondCurrency);
  });

  test("Burning liquidities provides Burn and settle", async () => {
    await waitNewBlock();
    // The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintliquidity(
      testUser1,
      sudo,
      new BN(defaultCurrecyValue),
      new BN(defaultCurrecyValue).div(new BN(2)),
      new BN(defaultCurrecyValue).div(new BN(4))
    );

    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(defaultCurrecyValue).div(new BN(4))
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "LiquidityBurned",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    //burn liquidity does not add any treasury.
    await validateTreasuryAmountsEqual(firstCurrency, [new BN(0), new BN(0)]);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });

  test("Burning liquidities generates a Liquidity burned event", async () => {
    await waitNewBlock();
    // The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintliquidity(
      testUser1,
      sudo,
      new BN(defaultCurrecyValue),
      new BN(defaultCurrecyValue).div(new BN(2)),
      new BN(defaultCurrecyValue).div(new BN(4))
    );
    const burnAmount = new BN(defaultCurrecyValue).div(new BN(4));
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    let eventResponse: EventResult = new EventResult(0, "");
    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      burnAmount
    ).then((result) => {
      eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "LiquidityBurned",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const secondCurrencyAmount = testUser1
      .getAsset(secondCurrency)
      ?.amountAfter.sub(testUser1.getAsset(secondCurrency)?.amountBefore!)!;
    const firstCurrencyAmount = testUser1
      .getAsset(firstCurrency)
      ?.amountAfter.sub(testUser1.getAsset(firstCurrency)?.amountBefore!)!;
    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency
    );
    validateMintedLiquidityEvent(
      eventResponse,
      testUser1.keyRingPair.address,
      firstCurrency,
      firstCurrencyAmount,
      secondCurrency,
      secondCurrencyAmount,
      liquidityAssetId,
      burnAmount
    );
  });
});

async function UserCreatesAPoolAndMintliquidity(
  testUser1: User,
  sudo: User,
  userAmount: BN,
  poolAmount: BN = new BN(userAmount).div(new BN(2)),
  mintAmount: BN = new BN(userAmount).div(new BN(4))
) {
  await waitNewBlock();
  const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [userAmount, userAmount],
    sudo
  );
  await testUser1.addMGATokens(sudo);
  await signSendAndWaitToFinishTx(
    api?.tx.xyk.createPool(
      firstCurrency,
      poolAmount,
      secondCurrency,
      poolAmount
    ),
    testUser1.keyRingPair
  );
  await waitNewBlock();
  await testUser1.mintLiquidity(firstCurrency, secondCurrency, mintAmount);
  return [firstCurrency, secondCurrency];
}
