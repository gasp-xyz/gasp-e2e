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
  getLiquidityAssetId,
  burnLiquidity,
  calculate_buy_price_local,
  getLiquidityPool,
  createPool,
} from "../../utils/tx";
import {
  waitNewBlock,
  ExtrinsicResult,
  EventResult,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateMintedLiquidityEvent,
  validateTreasuryAmountsEqual,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { calculateLiqAssetAmount } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { getSudoUser } from "../../utils/setup";

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
    keyring = new Keyring({ type: "ethereum" });

    // setup users
    testUser1 = new User(keyring);

    sudo = getSudoUser();

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
  });

  test("Get affected after a transaction that devaluates X wallet & pool states with [0,0]", async () => {
    const assetXamount = new BN(1000);
    const assetYamount = new BN(10);
    //create a new user
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [assetXamount, assetYamount],
      sudo,
    );
    await testUser1.addGASPTokens(sudo);
    //lets create a pool
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      assetXamount,
      secondCurrency,
      assetYamount,
    );
    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    const liquidityPoolBeforeDestroy = await getLiquidityPool(liquidityAssetId);

    await testUser2.addGASPTokens(sudo);
    const amountOfX = calculate_buy_price_local(
      new BN(assetXamount),
      new BN(assetYamount),
      new BN(9),
    );
    await sudo.mint(firstCurrency, testUser2, amountOfX);
    //user2 exange some assets.
    await testUser2.buyAssets(
      firstCurrency,
      secondCurrency,
      new BN(9),
      amountOfX.add(new BN(1)),
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const ownedLiquidityAssets = calculateLiqAssetAmount(
      assetXamount,
      assetYamount,
    );
    //user1 can still burn all the assets, eventhough pool got modified.

    const liqAsseIdBeforeBurningIt = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      ownedLiquidityAssets,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityBurned",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitNewBlock(); //lets wait one block until liquidity asset Id gets destroyed. Avoid flakiness ;)
    const liqAssetAfterBurning = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    expect(liqAssetAfterBurning).bnEqual(liqAsseIdBeforeBurningIt);
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    //TODO: validate with Stano.
    const fee = new BN(10);
    let amount = amountOfX.add(new BN(assetXamount)).sub(fee);
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      amount,
    );

    amount = new BN(1);
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      amount,
    );

    expect([new BN(0), new BN(0)]).collectionBnEqual(poolBalance);

    //Validate liquidity pool is NOT destroyed.
    const liquidityPool = await getLiquidityPool(liquidityAssetId);
    expect(liquidityPool[0]).bnEqual(firstCurrency);
    expect(liquidityPool[1]).bnEqual(secondCurrency);

    expect(liquidityPoolBeforeDestroy[0]).bnEqual(firstCurrency);
    expect(liquidityPoolBeforeDestroy[1]).bnEqual(secondCurrency);
  });

  test("Burning liquidities provides Burn and settle", async () => {
    // The second currency value is : defaultCurrencyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintLiquidity(
      testUser1,
      sudo,
      new BN(defaultCurrecyValue),
      new BN(defaultCurrecyValue).div(new BN(2)),
      new BN(defaultCurrecyValue).div(new BN(4)),
    );

    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(defaultCurrecyValue).div(new BN(4)),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
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
    // The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintLiquidity(
      testUser1,
      sudo,
      new BN(defaultCurrecyValue),
      new BN(defaultCurrecyValue).div(new BN(2)),
      new BN(defaultCurrecyValue).div(new BN(4)),
    );
    const burnAmount = new BN(defaultCurrecyValue).div(new BN(4));
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    let eventResponse: EventResult = new EventResult(0, "");
    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      burnAmount,
    ).then((result) => {
      eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityBurned",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const secondCurrencyAmount = testUser1
      .getAsset(secondCurrency)
      ?.amountAfter.free.sub(
        testUser1.getAsset(secondCurrency)?.amountBefore.free!,
      )!;
    const firstCurrencyAmount = testUser1
      .getAsset(firstCurrency)
      ?.amountAfter.free.sub(
        testUser1.getAsset(firstCurrency)?.amountBefore.free!,
      )!;
    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    validateMintedLiquidityEvent(
      eventResponse,
      testUser1.keyRingPair.address,
      firstCurrency,
      firstCurrencyAmount,
      secondCurrency,
      secondCurrencyAmount,
      liquidityAssetId,
      burnAmount,
    );
  });
});

async function UserCreatesAPoolAndMintLiquidity(
  testUser1: User,
  sudo: User,
  userAmount: BN,
  poolAmount: BN = new BN(userAmount).div(new BN(2)),
  mintAmount: BN = new BN(userAmount).div(new BN(4)),
) {
  const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [userAmount, userAmount],
    sudo,
  );
  await testUser1.addGASPTokens(sudo);
  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    poolAmount,
    secondCurrency,
    poolAmount,
  );

  await testUser1.mintLiquidity(firstCurrency, secondCurrency, mintAmount);
  return [firstCurrency, secondCurrency];
}
