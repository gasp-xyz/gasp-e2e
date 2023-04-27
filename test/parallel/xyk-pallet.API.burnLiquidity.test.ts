/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  getLiquidityAssetId,
  burnLiquidity,
  calculate_buy_price_local,
  getLiquidityPool,
  activateLiquidity,
} from "../../utils/tx";
import {
  waitNewBlock,
  ExtrinsicResult,
  EventResult,
  waitForRewards,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateMintedLiquidityEvent,
  validateTreasuryAmountsEqual,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import {
  calculateLiqAssetAmount,
  getEnvironmentRequiredVars,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Xyk } from "../../utils/xyk";
import { Sudo } from "../../utils/sudo";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO } from "@mangata-finance/sdk";

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
    //lets create a pool
    await (
      await getMangataInstance()
    ).createPool(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      assetXamount,
      secondCurrency.toString(),
      assetYamount
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
    //user2 exange some assets.
    await testUser2.buyAssets(
      firstCurrency,
      secondCurrency,
      new BN(9),
      amountOfX.add(new BN(1))
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const ownedLiquidityAssets = calculateLiqAssetAmount(
      assetXamount,
      assetYamount
    );
    //user1 can still burn all the assets, eventhough pool got modified.
    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      ownedLiquidityAssets
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityBurned",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitNewBlock(); //lets wait one block until liquidity asset Id gets destroyed. Avoid flakiness ;)
    const liqId = await getLiquidityAssetId(firstCurrency, secondCurrency);
    expect(liqId).bnEqual(new BN(-1));
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    //TODO: validate with Stano.
    const fee = new BN(10);
    let amount = amountOfX.add(new BN(assetXamount)).sub(fee);
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      amount
    );

    amount = new BN(1);
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      amount
    );

    expect([BN_ZERO, BN_ZERO]).collectionBnEqual(poolBalance);

    //Validate liquidity pool is destroyed.
    const liquidityPool = await getLiquidityPool(liquidityAssetId);
    expect(liquidityPool[0]).bnEqual(new BN(-1));
    expect(liquidityPool[1]).bnEqual(new BN(-1));

    expect(liquidityPoolBeforeDestroy[0]).bnEqual(firstCurrency);
    expect(liquidityPoolBeforeDestroy[1]).bnEqual(secondCurrency);
  });

  test("Burning liquidities provides Burn and settle", async () => {
    // The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintLiquidity(
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
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityBurned",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    //burn liquidity does not add any treasury.
    await validateTreasuryAmountsEqual(firstCurrency, [BN_ZERO, BN_ZERO]);
    await validateTreasuryAmountsEqual(secondCurrency, [BN_ZERO, BN_ZERO]);
  });

  test("Burning liquidities generates a Liquidity burned event", async () => {
    // The second currecy value is : defaultCurrecyValue, one to create the pool later, and the other one because of the rounding issue.
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintLiquidity(
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
        testUser1.getAsset(secondCurrency)?.amountBefore.free!
      )!;
    const firstCurrencyAmount = testUser1
      .getAsset(firstCurrency)
      ?.amountAfter.free.sub(
        testUser1.getAsset(firstCurrency)?.amountBefore.free!
      )!;
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

  test("Given a pool with 2 users with activated rewards WHEN more than one period last AND the user burn all liquidity THEN pool is destroyed but users can still claim pending rewards", async () => {
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    [firstCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [new BN(defaultCurrecyValue)],
      sudo
    );

    testUser1.addAsset(MGA_ASSET_ID);
    testUser2.addAsset(MGA_ASSET_ID);

    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintNative(testUser1),
      Assets.mintToken(firstCurrency, testUser2, new BN(defaultCurrecyValue)),
      Assets.mintNative(testUser2)
    );

    const mga = await getMangataInstance();

    await mga.createPool(
      testUser1.keyRingPair,
      MGA_ASSET_ID.toString(),
      new BN(defaultCurrecyValue).div(new BN(2)),
      firstCurrency.toString(),
      new BN(defaultCurrecyValue).div(new BN(2))
    );

    const liquidityAssetId = await getLiquidityAssetId(
      MGA_ASSET_ID,
      firstCurrency
    );

    const poolBeforeBurning = await getBalanceOfPool(
      MGA_ASSET_ID,
      firstCurrency
    );

    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser2,
        Xyk.mintLiquidity(
          MGA_ASSET_ID,
          firstCurrency,
          new BN(defaultCurrecyValue).div(new BN(2))
        )
      ),
      Assets.promotePool(liquidityAssetId.toNumber(), 20)
    );
    await activateLiquidity(
      testUser1.keyRingPair,
      liquidityAssetId,
      new BN(defaultCurrecyValue).div(new BN(2))
    );
    await activateLiquidity(
      testUser2.keyRingPair,
      liquidityAssetId,
      new BN(defaultCurrecyValue).div(new BN(2))
    );

    await waitForRewards(testUser1, liquidityAssetId);

    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser1,
        Xyk.burnLiquidity(
          MGA_ASSET_ID,
          firstCurrency,
          new BN(defaultCurrecyValue).div(new BN(2))
        )
      ),
      Sudo.sudoAs(
        testUser2,
        Xyk.burnLiquidity(
          MGA_ASSET_ID,
          firstCurrency,
          new BN(defaultCurrecyValue).div(new BN(2))
        )
      )
    );

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liquidityAssetId)),
      Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liquidityAssetId))
    );

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    const differenceMGAUser1 = testUser1
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
      );
    const differenceMGAUser2 = testUser2
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free.sub(
        testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!
      );

    const poolAfterBurning = await getBalanceOfPool(
      MGA_ASSET_ID,
      firstCurrency
    );

    expect(poolBeforeBurning[0]).bnGt(BN_ZERO);
    expect(poolAfterBurning[0]).bnEqual(BN_ZERO);
    expect(differenceMGAUser1).bnGt(BN_ZERO);
    expect(differenceMGAUser2).bnGt(BN_ZERO);
  });
});

async function UserCreatesAPoolAndMintLiquidity(
  testUser1: User,
  sudo: User,
  userAmount: BN,
  poolAmount: BN = new BN(userAmount).div(new BN(2)),
  mintAmount: BN = new BN(userAmount).div(new BN(4))
) {
  const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [userAmount, userAmount],
    sudo
  );
  await testUser1.addMGATokens(sudo);
  await (
    await getMangataInstance()
  ).createPool(
    testUser1.keyRingPair,
    firstCurrency.toString(),
    poolAmount,
    secondCurrency.toString(),
    poolAmount
  );

  await testUser1.mintLiquidity(firstCurrency, secondCurrency, mintAmount);
  return [firstCurrency, secondCurrency];
}
