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
  mintLiquidity,
  getLiquidityAssetId,
} from "../../utils/tx";
import { ExtrinsicResult, EventResult } from "../../utils/eventListeners";
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
import { createPool } from "../../utils/tx";
import { getSudoUser } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const defaultCurrencyValue = new BN(250000);

describe("xyk-pallet - Mint liquidity tests: with minting you can", () => {
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

  test("Add all the wallet assets to the pool", async () => {
    //valdiated with Gleb the rounding issue to preserve the x*y =k
    const roundingIssue = new BN(1);

    // The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [
        defaultCurrencyValue.add(new BN(1)),
        defaultCurrencyValue.add(new BN(1)).add(new BN(1)),
      ],
      sudo,
    );
    await testUser1.addMGATokens(sudo);
    const amounttoThePool = new BN(1);
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      amounttoThePool,
      secondCurrency,
      amounttoThePool,
    );
    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    testUser1.addAsset(liquidityAssetId);

    const poolBalanceWhenCreated = await getBalanceOfPool(
      firstCurrency,
      secondCurrency,
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await testUser1.mintLiquidity(
      firstCurrency,
      secondCurrency,
      new BN(defaultCurrencyValue),
    );
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const poolBalanceAfterMinting = await getBalanceOfPool(
      firstCurrency,
      secondCurrency,
    );
    expect([
      poolBalanceWhenCreated[0].add(new BN(defaultCurrencyValue)),
      poolBalanceWhenCreated[0]
        .add(new BN(defaultCurrencyValue))
        .add(roundingIssue),
    ]).collectionBnEqual(poolBalanceAfterMinting);

    let diffFromWallet = testUser1
      .getAsset(firstCurrency)
      ?.amountBefore.free!.sub(defaultCurrencyValue);
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    diffFromWallet = testUser1
      .getAsset(secondCurrency)
      ?.amountBefore.free!.sub(defaultCurrencyValue.add(roundingIssue));
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    //minting must not add any treasury
    const amount = calculateLiqAssetAmount(
      defaultCurrencyValue,
      defaultCurrencyValue,
    );
    const addFromWallet = testUser1
      .getAsset(liquidityAssetId)
      ?.amountBefore.free!.add(amount);
    expect(testUser1.getAsset(liquidityAssetId)?.amountAfter.free!).bnEqual(
      addFromWallet!,
    );

    await validateTreasuryAmountsEqual(firstCurrency, [new BN(0), new BN(0)]);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });

  test("Expect an event when liquidity is minted", async () => {
    // The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrencyValue, defaultCurrencyValue],
      sudo,
    );
    await testUser1.addMGATokens(sudo);
    const amounttoThePool = new BN(defaultCurrencyValue).div(new BN(2));
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      amounttoThePool,
      secondCurrency,
      amounttoThePool,
    );

    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    testUser1.addAsset(liquidityAssetId);

    const poolBalanceWhenCreated = await getBalanceOfPool(
      firstCurrency,
      secondCurrency,
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const injectedValue = amounttoThePool.div(new BN(2));
    let eventResponse: EventResult = new EventResult(0, "");
    await mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      injectedValue,
    ).then((result) => {
      eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityMinted",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const poolBalanceAfterMinting = await getBalanceOfPool(
      firstCurrency,
      secondCurrency,
    );
    const secondCurrencyAmountLost = testUser1
      .getAsset(secondCurrency)
      ?.amountBefore.free.sub(
        testUser1.getAsset(secondCurrency)?.amountAfter.free!,
      )!;
    // liquidity value matches with 2*minted_amount, since the pool is balanced.
    validateMintedLiquidityEvent(
      eventResponse,
      testUser1.keyRingPair.address,
      firstCurrency,
      injectedValue,
      secondCurrency,
      secondCurrencyAmountLost,
      liquidityAssetId,
      calculateLiqAssetAmount(injectedValue, injectedValue),
    );

    expect([
      poolBalanceWhenCreated[0].add(injectedValue),
      poolBalanceWhenCreated[1].add(secondCurrencyAmountLost),
    ]).collectionBnEqual(poolBalanceAfterMinting);

    let diffFromWallet = testUser1
      .getAsset(secondCurrency)
      ?.amountBefore.free!.sub(injectedValue);
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    diffFromWallet = testUser1
      .getAsset(secondCurrency)
      ?.amountBefore.free!.sub(secondCurrencyAmountLost);
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    //No trading - no Treasure added.
    const amount = calculateLiqAssetAmount(injectedValue, injectedValue);
    const addFromWallet = testUser1
      .getAsset(liquidityAssetId)
      ?.amountBefore.free!.add(amount);
    expect(testUser1.getAsset(liquidityAssetId)?.amountAfter.free!).bnEqual(
      addFromWallet!,
    );

    await validateTreasuryAmountsEqual(firstCurrency, [new BN(0), new BN(0)]);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });
});
