/*
 *
 * @group xyk
 * @group api
 * @group sequential
 * @group critical
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import {
  sellAsset,
  getTreasury,
  getTreasuryBurn,
  getAssetId,
  getBalanceOfPool,
  calculate_sell_price_local_no_fee,
  buyAsset,
  calculate_sell_price_rpc,
  calculate_buy_price_rpc,
} from "../../utils/tx";
import { ExtrinsicResult, waitNewBlock } from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateTreasuryAmountsEqual } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { MAX_BALANCE, MGA_ASSET_NAME } from "../../utils/Constants";
import { calculateFees, getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const first_asset_amount = new BN(50000);
const seccond_asset_amount = first_asset_amount.div(new BN(2));
const defaultCurrecyValue = new BN(250000);
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

describe("xyk-pallet - treasury tests [Mangata]: on treasury we store", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let secondCurrency: BN;
  let mgaTokenId: BN;

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

    mgaTokenId = await getAssetId(MGA_ASSET_NAME);
    await sudo.mint(
      mgaTokenId,
      testUser1,
      new BN(defaultCurrecyValue).add(new BN(Math.pow(10, 18).toString()))
    );
    testUser1.addAsset(mgaTokenId);
    secondCurrency = (
      await Assets.setupUserWithCurrencies(
        testUser1,
        [defaultCurrecyValue],
        sudo
      )
    )[0];
    await testUser1.addMGATokens(sudo);
    await (
      await getMangataInstance()
    ).createPool(
      testUser1.keyRingPair,
      mgaTokenId.toString(),
      first_asset_amount,
      secondCurrency.toString(),
      seccond_asset_amount
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("assets won when assets are sold [Selling Mangata] - 5", async () => {
    const sellAssetAmount = new BN(10000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    await sellAsset(
      testUser1.keyRingPair,
      mgaTokenId,
      secondCurrency,
      sellAssetAmount,
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const { treasury } = calculateFees(sellAssetAmount);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(treasury));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });

  test("assets won when assets are bought [Buying Mangata]", async () => {
    const buyAssetAmount = new BN(10000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    const sellPrice = await calculate_buy_price_rpc(
      seccond_asset_amount,
      first_asset_amount,
      buyAssetAmount
    );
    const { treasury } = calculateFees(sellPrice);

    await buyAsset(
      testUser1.keyRingPair,
      secondCurrency,
      mgaTokenId,
      buyAssetAmount,
      new BN(100000000)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    //fees are now calculated after the swap
    const poolBalance = await getBalanceOfPool(mgaTokenId, secondCurrency);
    const feeInMGAPrice = await calculate_sell_price_rpc(
      poolBalance[1],
      poolBalance[0],
      treasury
    );

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(feeInMGAPrice));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });

  test("assets won when assets are sold [Selling other in MGA pool] - 6", async () => {
    const sellAssetAmount = new BN(20000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    const { treasury } = calculateFees(sellAssetAmount);
    await sellAsset(
      testUser1.keyRingPair,
      secondCurrency,
      mgaTokenId,
      sellAssetAmount,
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const poolBalance = await getBalanceOfPool(mgaTokenId, secondCurrency);
    const feeInMGAPrice = await calculate_sell_price_rpc(
      poolBalance[1],
      poolBalance[0],
      treasury
    );
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(feeInMGAPrice));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });

  test("assets won when assets are bought [Buying other in MGA pool]", async () => {
    const buyAssetAmount = new BN(10000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    const sellPrice = await calculate_buy_price_rpc(
      first_asset_amount,
      seccond_asset_amount,
      buyAssetAmount
    );
    const { treasury } = calculateFees(sellPrice);

    await buyAsset(
      testUser1.keyRingPair,
      mgaTokenId,
      secondCurrency,
      buyAssetAmount,
      new BN(100000000)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(treasury));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });
});

describe("xyk-pallet - treasury tests [Connected - Mangata]: on treasury we store", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let connectedToMGA: BN, indirectlyConnected: BN;
  let mgaTokenId: BN;

  //creating pool

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    mgaTokenId = await getAssetId(MGA_ASSET_NAME);
    await sudo.mint(
      mgaTokenId,
      testUser1,
      new BN(defaultCurrecyValue).add(new BN(Math.pow(10, 18).toString()))
    );
    testUser1.addAsset(mgaTokenId);
    connectedToMGA = (
      await Assets.setupUserWithCurrencies(
        testUser1,
        [defaultCurrecyValue],
        sudo
      )
    )[0];
    indirectlyConnected = (
      await Assets.setupUserWithCurrencies(
        testUser1,
        [defaultCurrecyValue],
        sudo
      )
    )[0];
    await testUser1.addMGATokens(sudo);
    await (
      await getMangataInstance()
    ).createPool(
      testUser1.keyRingPair,
      mgaTokenId.toString(),
      first_asset_amount,
      connectedToMGA.toString(),
      first_asset_amount.div(new BN(2))
    );
    await (
      await getMangataInstance()
    ).createPool(
      testUser1.keyRingPair,
      connectedToMGA.toString(),
      first_asset_amount,
      indirectlyConnected.toString(),
      first_asset_amount.div(new BN(2))
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("assets won when assets are sold [Selling X connected to MGA pool] - rounding", async () => {
    const sellAssetAmount = new BN(20000);

    const mgPoolAmount = await getBalanceOfPool(mgaTokenId, connectedToMGA);
    const { treasury } = calculateFees(sellAssetAmount);
    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury
    );
    const twotreasuries = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury.mul(new BN(2))
    );

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    await sellAsset(
      testUser1.keyRingPair,
      connectedToMGA,
      indirectlyConnected,
      sellAssetAmount,
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    const mgPoolAmountAfter = await getBalanceOfPool(
      mgaTokenId,
      connectedToMGA
    );
    expect(mgPoolAmountAfter[1].sub(mgPoolAmount[1])).bnEqual(
      treasury.add(treasury)
    );
    //( mgPoolAmount[0].toNumber() * 11 * 1000 ) / (  ( ( mgPoolAmount[1].toNumber() + 11) * 1000) )
    // 21.990324257326776 <-- rounding issue, so 21 goes to trasury, that is: swapTreasuryInMG
    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));
    //since the fee burn is calculated like: TotalBurn - fee, so its 45 - 22 = 23.
    expect(mgPoolAmountAfter[0].add(twotreasuries)).bnEqual(
      mgPoolAmount[0].sub(new BN(1))
    );
    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(indirectlyConnected, [
      new BN(0),
      new BN(0),
    ]);
  });

  test("assets won when assets are bought [Buying X connected to MGA pool]", async () => {
    const buyAssetAmount = new BN(7000);

    const PoolAmount = await getBalanceOfPool(
      indirectlyConnected,
      connectedToMGA
    );

    const sellPrice = await calculate_buy_price_rpc(
      PoolAmount[1],
      PoolAmount[0],
      buyAssetAmount
    );
    const { treasury } = calculateFees(sellPrice);

    const mgPoolAmount = await getBalanceOfPool(mgaTokenId, connectedToMGA);
    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury
    );

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    await buyAsset(
      testUser1.keyRingPair,
      connectedToMGA,
      indirectlyConnected,
      buyAssetAmount,
      new BN(10000000)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));

    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    await validateTreasuryAmountsEqual(indirectlyConnected, [
      new BN(0),
      new BN(0),
    ]);
  });

  test("assets won when assets are sold [Selling Y - X connected toMGA pool] - 6", async () => {
    const sellAssetAmount = new BN(20000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    const treasuryBeforeInd = await getTreasury(indirectlyConnected);
    const treasuryBurnBeforeInd = await getTreasuryBurn(indirectlyConnected);

    const { treasury, treasuryBurn } = calculateFees(sellAssetAmount);

    await sellAsset(
      testUser1.keyRingPair,
      indirectlyConnected,
      connectedToMGA,
      sellAssetAmount,
      new BN(1)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    const treasuryAfterInd = await getTreasury(indirectlyConnected);
    const treasuryBurnAfterInd = await getTreasuryBurn(indirectlyConnected);

    expect(treasuryAfter).bnEqual(treasuryBefore);
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);

    expect(treasuryAfterInd).bnEqual(treasuryBeforeInd.add(treasury));
    expect(treasuryBurnAfterInd).bnEqual(
      treasuryBurnBeforeInd.add(treasuryBurn)
    );
  });

  test("assets won when assets are bought [Buying Y - X connected toMGA pool] - 6", async () => {
    const buyAssetAmount = new BN(6000);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    const PoolAmount = await getBalanceOfPool(
      indirectlyConnected,
      connectedToMGA
    );
    const sellPrice = await calculate_buy_price_rpc(
      PoolAmount[1],
      PoolAmount[0],
      buyAssetAmount
    );
    const { treasury } = calculateFees(sellPrice);

    const mgPoolAmount = await getBalanceOfPool(mgaTokenId, connectedToMGA);
    const swapTreasuryInMG = calculate_sell_price_local_no_fee(
      mgPoolAmount[1],
      mgPoolAmount[0],
      treasury
    );

    await buyAsset(
      testUser1.keyRingPair,
      connectedToMGA,
      indirectlyConnected,
      buyAssetAmount,
      new BN(1000000)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    expect(treasuryAfter).bnEqual(treasuryBefore.add(swapTreasuryInMG));
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);

    await validateTreasuryAmountsEqual(indirectlyConnected, [
      new BN(0),
      new BN(0),
    ]);
  });
});

describe("xyk-pallet - treasury tests [Connected - Mangata]: Error cases", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let connectedToMGA: BN;
  let mgaTokenId: BN;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    await waitNewBlock();
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    await waitNewBlock();
    mgaTokenId = await getAssetId(MGA_ASSET_NAME);
    await sudo.mint(
      mgaTokenId,
      testUser1,
      new BN(defaultCurrecyValue).add(new BN(Math.pow(10, 18).toString()))
    );
    testUser1.addAsset(mgaTokenId);
    connectedToMGA = (
      await Assets.setupUserWithCurrencies(testUser1, [MAX_BALANCE], sudo)
    )[0];
    await testUser1.addMGATokens(sudo);
  });

  test("Not enough tokens to convert fee LINK[https://trello.com/c/p77t0atO]", async () => {
    await (
      await getMangataInstance()
    ).createPool(
      testUser1.keyRingPair,
      mgaTokenId.toString(),
      new BN(100),
      connectedToMGA.toString(),
      first_asset_amount
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await waitNewBlock();
    const mgPoolAmount = await getBalanceOfPool(mgaTokenId, connectedToMGA);

    const treasuryBefore = await getTreasury(mgaTokenId);
    const treasuryBurnBefore = await getTreasuryBurn(mgaTokenId);

    const treasuryBeforeConnectedAsset = await getTreasury(connectedToMGA);
    const treasuryBurnBeforeConnectedAsset = await getTreasuryBurn(
      connectedToMGA
    );

    await buyAsset(
      testUser1.keyRingPair,
      connectedToMGA,
      mgaTokenId,
      mgPoolAmount[0].sub(new BN(1)),
      new BN(MAX_BALANCE)
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const treasuryAfter = await getTreasury(mgaTokenId);
    const treasuryBurnAfter = await getTreasuryBurn(mgaTokenId);

    const treasuryAfterConnectedAsset = await getTreasury(connectedToMGA);
    const treasuryBurnAfterConnectedAsset = await getTreasuryBurn(
      connectedToMGA
    );

    const poolAfter = await getBalanceOfPool(mgaTokenId, connectedToMGA);

    //Check that the pool has only one MGA token.
    expect(poolAfter[0]).bnEqual(new BN(1));
    //Check that the user has the right amount of MGA tokens.
    //The ones he had before + bought. 99
    const expectedValue = testUser1
      .getAsset(mgaTokenId)!
      .amountAfter.free.sub(mgPoolAmount[0].sub(new BN(1)));

    expect(testUser1.getAsset(mgaTokenId)!.amountBefore.free).bnEqual(
      expectedValue
    );
    //burned destroyed! because is translated toMGA
    expect(treasuryBurnAfter).bnEqual(treasuryBurnBefore);
    //check that treasury got the right amount.
    //not enough tokens to get the fee.
    expect(treasuryAfter).bnEqual(treasuryBefore);
    expect(
      treasuryAfterConnectedAsset.sub(treasuryBeforeConnectedAsset)
    ).bnEqual(new BN(0));
    expect(
      treasuryBurnAfterConnectedAsset.sub(treasuryBurnBeforeConnectedAsset)
    ).bnEqual(new BN(0));
  });
});
