/*
 *
 * @group xyk
 * @group market
 * @group api
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  getLiquidityAssetId,
  getAssetSupply,
  getNextAssetId,
  mintLiquidity,
  burnLiquidity,
  createPool,
  getLiquidityPool,
} from "../../utils/tx";
import { ExtrinsicResult, EventResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateAssetsWithValues,
  validatePoolCreatedEvent,
  validateStatusWhenPoolCreated,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { calculateLiqAssetAmount, xykErrors } from "../../utils/utils";
import { testLog } from "../../utils/Logger";
import { hexToBn } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Sudo } from "../../utils/sudo";
import { getSudoUser } from "../../utils/setup";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const first_asset_amount = new BN(50000);
const second_asset_amount = new BN(50000);
const defaultCurrecyValue = new BN(250000);

describe("xyk-pallet - Poll creation: Errors:", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

  //creating pool
  const pool_balance_before = [new BN(0), new BN(0)];
  const total_liquidity_assets_before = new BN(0);

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

    //add two curerncies and balance to testUser:
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo,
    );
    await testUser1.addGASPTokens(sudo);
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    // check users accounts.
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    validateAssetsWithValues(
      [
        testUser1.getAsset(firstCurrency)?.amountBefore.free!,
        testUser1.getAsset(secondCurrency)?.amountBefore.free!,
      ],
      [
        defaultCurrecyValue.toNumber(),
        defaultCurrecyValue.add(new BN(1)).toNumber(),
      ],
    );

    let eventResponse: EventResult = new EventResult(0, "");
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount,
    ).then((result) => {
      eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "PoolCreated",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    //validate the content of the event about the pool creation.
    await validatePoolCreatedEvent(
      eventResponse,
      testUser1.keyRingPair.address,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount,
    );
    await validateStatusWhenPoolCreated(
      firstCurrency,
      secondCurrency,
      testUser1,
      pool_balance_before,
      total_liquidity_assets_before,
    );
  });
  test("Create x-y and y-x pool", async () => {
    testLog
      .getLog()
      .info(
        "testUser1: creating pool already created " +
          firstCurrency +
          " - " +
          secondCurrency,
      );
    await createPool(
      testUser1.keyRingPair,
      secondCurrency,
      new BN(666),
      firstCurrency,
      new BN(666),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.PoolAlreadyExists);
    });
  });
  test("Create pool with zero", async () => {
    const nextAssetId = await getNextAssetId();
    const emptyAssetID = new BN(nextAssetId.toString());

    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      new BN(0),
      emptyAssetID,
      new BN(0),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.ZeroAmount);
    });

    const balance = await getBalanceOfPool(firstCurrency, emptyAssetID);
    expect(balance).collectionBnEqual([new BN(0), new BN(0)]);
  });
  test("Not enough assets", async () => {
    const txAmount = new BN(100000000000000);
    const testAssetId = await Assets.setupUserWithCurrencies(
      testUser1,
      [txAmount],
      sudo,
    );

    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      new BN(txAmount).add(new BN(1)),
      testAssetId[0],
      new BN(txAmount).add(new BN(1)),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });

    const balance = await getBalanceOfPool(firstCurrency, testAssetId[0]);
    expect(balance).collectionBnEqual([new BN(0), new BN(0)]);
  });
});

describe("xyk-pallet - Pool tests: a pool can:", () => {
  let testUser1: User;
  let testUser2: User;
  let keyring: Keyring;

  let firstCurrency: BN;
  let secondCurrency: BN;

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "ethereum" });
    // setup a second user
    testUser2 = new User(keyring);
    testUser1 = new User(keyring);
    const sudo = getSudoUser();
    keyring.addPair(testUser2.keyRingPair);
    keyring.addPair(testUser1.keyRingPair);

    //add two curerncies and balance to testUser2:

    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo,
    );

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser1),
      Assets.mintNative(testUser2),
      Sudo.sudoAs(
        testUser1,
        Market.createPool(
          firstCurrency,
          first_asset_amount,
          secondCurrency,
          second_asset_amount,
        ),
      ),
      Assets.mintToken(firstCurrency, testUser2, new BN(10000)),
      Assets.mintToken(secondCurrency, testUser2, new BN(10000)),
    );

    await testUser2.addAssets([firstCurrency, secondCurrency]);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    validateAssetsWithValues(
      [
        testUser2.getAsset(firstCurrency)?.amountBefore.free!,
        testUser2.getAsset(secondCurrency)?.amountBefore.free!,
      ],
      [10000, 10000],
    );
  });

  test("be minted", async () => {
    await mintLiquidity(
      testUser2.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(5000),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityMinted",
        testUser2.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    const liquidity_asset_id = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    const liquidity_assets_minted = calculateLiqAssetAmount(
      first_asset_amount,
      second_asset_amount,
    );
    testUser2.addAsset(liquidity_asset_id, new BN(0));
    await testUser2.refreshAmounts(AssetWallet.AFTER);

    const addFromWallet = testUser2
      .getAsset(liquidity_asset_id)
      ?.amountBefore.free!.add(new BN(5000));
    expect(testUser2.getAsset(liquidity_asset_id)?.amountAfter.free!).bnEqual(
      addFromWallet!,
    );

    let diffFromWallet = testUser2
      .getAsset(firstCurrency)
      ?.amountBefore.free!.sub(new BN(5000));
    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    diffFromWallet = testUser2
      .getAsset(secondCurrency)
      ?.amountBefore.free!.sub(new BN(5000).add(new BN(1)));
    expect(testUser2.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    //TODO: pending to validate.
    const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect([
      new BN(first_asset_amount).add(new BN(5000)),
      new BN(second_asset_amount).add(new BN(5000).add(new BN(1))),
    ]).collectionBnEqual(pool_balance);

    const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
    expect(liquidity_assets_minted.add(new BN(5000))).bnEqual(
      total_liquidity_assets,
    );
  });

  test("be burn", async () => {
    testLog
      .getLog()
      .info(
        "User: minting liquidity " + firstCurrency + " - " + secondCurrency,
      );
    await mintLiquidity(
      testUser2.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(5000),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityMinted",
        testUser2.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await testUser2.refreshAmounts(AssetWallet.BEFORE);

    const liquidity_asset_id = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    const liquidity_assets_minted = calculateLiqAssetAmount(
      first_asset_amount,
      second_asset_amount,
    );

    testUser2.addAsset(liquidity_asset_id, new BN(0));
    await testUser2.refreshAmounts(AssetWallet.BEFORE);

    testLog
      .getLog()
      .info("User: burn liquidity " + firstCurrency + " - " + secondCurrency);
    await burnLiquidity(
      testUser2.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(2500),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityBurned",
        testUser2.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser2.refreshAmounts(AssetWallet.AFTER);

    const diffFromWallet = testUser2
      .getAsset(liquidity_asset_id)
      ?.amountBefore.free!.sub(new BN(2500));
    expect(testUser2.getAsset(liquidity_asset_id)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    let addFromWallet = testUser2
      .getAsset(firstCurrency)
      ?.amountBefore.free!.add(new BN(2500));
    expect(testUser2.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      addFromWallet!,
    );

    addFromWallet = testUser2
      .getAsset(secondCurrency)
      ?.amountBefore.free!.add(new BN(2500));
    expect(testUser2.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      addFromWallet!,
    );

    //TODO: pending to validate.
    const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect([
      new BN(first_asset_amount).add(new BN(2500)),
      new BN(second_asset_amount).add(new BN(2500).add(new BN(1))),
    ]).collectionBnEqual(pool_balance);

    const total_liquidity_assets = await getAssetSupply(liquidity_asset_id);
    expect(liquidity_assets_minted.add(new BN(2500))).bnEqual(
      total_liquidity_assets,
    );
  });

  afterEach(async () => {
    // those values must not change.
    const liquidity_asset_id = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    const liquidity_assets_minted = calculateLiqAssetAmount(
      first_asset_amount,
      second_asset_amount,
    );

    testUser1.addAsset(liquidity_asset_id, new BN(0));
    //validate
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    let diffFromWallet = testUser1
      .getAsset(firstCurrency)
      ?.amountBefore.free!.sub(first_asset_amount);
    expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    diffFromWallet = testUser1
      .getAsset(secondCurrency)
      ?.amountBefore.free!.sub(second_asset_amount);
    expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
      diffFromWallet!,
    );

    const addFromWallet = testUser1
      .getAsset(liquidity_asset_id)
      ?.amountBefore.free!.add(liquidity_assets_minted);
    expect(testUser1.getAsset(liquidity_asset_id)?.amountAfter.free!).bnEqual(
      addFromWallet!,
    );
  });
});

describe("xyk-pallet - Pool opeations: Simmetry", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

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

    //add two currencies and balance to testUser:
    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
      sudo,
    );
    await testUser1.addGASPTokens(sudo, new BN("100000000000000000000000"));
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    // check users accounts.
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    validateAssetsWithValues(
      [
        testUser1.getAsset(firstCurrency)?.amountBefore.free!,
        testUser1.getAsset(secondCurrency)?.amountBefore.free!,
      ],
      [
        defaultCurrecyValue.toNumber(),
        defaultCurrecyValue.add(new BN(1)).toNumber(),
      ],
    );

    let eventResponse: EventResult = new EventResult(0, "");
    await createPool(
      testUser1.keyRingPair,
      secondCurrency,
      first_asset_amount,
      firstCurrency,
      second_asset_amount,
    ).then((result) => {
      eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "PoolCreated",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  });
  test("GetBalance x-y and y-x pool", async () => {
    const api = await getApi();
    const poolAssetsXY = await api.query.xyk.pools([
      firstCurrency,
      secondCurrency,
    ]);
    const assetValueXY = [
      hexToBn(JSON.parse(poolAssetsXY.toString())[0]),
      hexToBn(JSON.parse(poolAssetsXY.toString())[1]),
    ];
    const poolAssetsYX = await api.query.xyk.pools([
      secondCurrency,
      firstCurrency,
    ]);
    const assetValueYX = [
      hexToBn(JSON.parse(poolAssetsYX.toString())[0]),
      hexToBn(JSON.parse(poolAssetsYX.toString())[1]),
    ];

    expect(assetValueXY).not.collectionBnEqual(assetValueYX);
    const poolValuesXY = await getBalanceOfPool(secondCurrency, firstCurrency);
    const poolValuesYX = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect(poolValuesXY).collectionBnEqual(poolValuesYX);
  });
  test("Minting x-y and y-x pool", async () => {
    await testUser1.mintLiquidity(firstCurrency, secondCurrency, new BN(100));
    await testUser1.mintLiquidity(secondCurrency, firstCurrency, new BN(100));
  });
  test("Burning x-y and y-x pool", async () => {
    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(100),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await burnLiquidity(
      testUser1.keyRingPair,
      secondCurrency,
      firstCurrency,
      new BN(100),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  });
  test("GetLiquidityAssetID x-y and y-x pool", async () => {
    const api = getApi();
    const liqXYK = await api.query.xyk.liquidityAssets([
      firstCurrency,
      secondCurrency,
    ]);
    const liqYXK = await api.query.xyk.liquidityAssets([
      secondCurrency,
      firstCurrency,
    ]);
    expect(new BN(liqXYK.toString())).not.bnEqual(new BN(liqYXK.toString()));

    const liqXY = await getLiquidityAssetId(firstCurrency, secondCurrency);
    const liqYX = await getLiquidityAssetId(secondCurrency, firstCurrency);
    const pool = await getLiquidityPool(liqYX);
    expect(
      pool.some((x) => x.toString() === firstCurrency.toString()),
    ).toBeTruthy();
    expect(
      pool.some((x) => x.toString() === secondCurrency.toString()),
    ).toBeTruthy();
    expect(liqXY).bnEqual(liqYX);
  });
});
