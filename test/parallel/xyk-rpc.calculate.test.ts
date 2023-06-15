/*
 *
 * @group xyk
 * @group calculate
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calculate_buy_price_rpc,
  calculate_sell_price_rpc,
  getBalanceOfPool,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;

// Assuming the pallet's AccountId
const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const firstAssetAmount = 1000;
const seccondAssetAmount = 1000;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  const sudo = new User(keyring, sudoUserName);

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [new BN(firstAssetAmount * 2), new BN(seccondAssetAmount * 2)],
    sudo
  );
  await testUser1.addMGATokens(sudo);
  await testUser1.createPoolToAsset(
    new BN(firstAssetAmount),
    new BN(seccondAssetAmount),
    firstCurrency,
    secondCurrency
  );

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
});

beforeEach(async () => {
  // check users accounts.

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-rpc - calculate_sell_price and calculate_buy_price matches, 1000,1000", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency
  );

  const numberOfAssets = new BN(100);
  const sellPriceRpc = await calculate_sell_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    numberOfAssets
  );
  const sellPriceRpcInverse = await calculate_sell_price_rpc(
    poolBalanceBefore[1],
    poolBalanceBefore[0],
    numberOfAssets
  );

  const buyPriceRpc = await calculate_buy_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    sellPriceRpc
  );
  const buyPriceRpcInverse = await calculate_buy_price_rpc(
    poolBalanceBefore[1],
    poolBalanceBefore[0],
    sellPriceRpc
  );

  //in a perfect balanced pool, those number match
  expect(sellPriceRpcInverse).bnEqual(sellPriceRpc);
  expect(buyPriceRpc).bnEqual(buyPriceRpcInverse);

  //the relation of buy and sell is maintained.
  expect(buyPriceRpc).bnEqual(numberOfAssets);
});

test("xyk-rpc - calculate_sell_price and calculate_buy_price matches, 2000,1000", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency
  );
  //lets unbalance it artificailly, now the relation is 2000X=1000Y
  poolBalanceBefore[0] = poolBalanceBefore[0].add(new BN(1000));

  const numberOfAssets = new BN(100);
  const sellPriceRpc = await calculate_sell_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    numberOfAssets
  );
  const sellPriceRpcInverse = await calculate_sell_price_rpc(
    poolBalanceBefore[1],
    poolBalanceBefore[0],
    numberOfAssets
  );

  const buyPriceRpc = await calculate_buy_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    sellPriceRpc
  );
  const buyPriceRpcInverse = await calculate_buy_price_rpc(
    poolBalanceBefore[1],
    poolBalanceBefore[0],
    sellPriceRpc
  );

  //in a not perfect balanced pool, those number can not match
  expect(sellPriceRpcInverse).not.bnEqual(sellPriceRpc);
  expect(buyPriceRpc).not.bnEqual(buyPriceRpcInverse);

  //the relation of buy and sell is maintained.
  //because of rounding, we need to expend one unit more
  expect(buyPriceRpc.add(new BN(1))).bnEqual(numberOfAssets);
});

test("xyk-rpc - calculate_sell_price matches with the real sell", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency
  );

  const numberOfAssets = new BN(100);
  const sellPriceRpc = await calculate_sell_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    numberOfAssets
  );
  await testUser1.sellAssets(firstCurrency, secondCurrency, numberOfAssets);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const assetsSold = testUser1.getAsset(firstCurrency)?.amountAfter;
  const assetsBought = testUser1.getAsset(secondCurrency)?.amountAfter;

  expect(assetsSold?.free).bnEqual(
    testUser1.getAsset(firstCurrency)?.amountBefore.free.sub(numberOfAssets)!
  );
  expect(assetsBought?.free).bnEqual(
    testUser1.getAsset(secondCurrency)?.amountBefore.free.add(sellPriceRpc)!
  );
});

test("xyk-rpc - calculate_buy_price matches with the real buy", async () => {
  const poolBalanceBefore = await getBalanceOfPool(
    firstCurrency,
    secondCurrency
  );

  const numberOfAssets = new BN(100);
  const sellPriceRpc = await calculate_buy_price_rpc(
    poolBalanceBefore[0],
    poolBalanceBefore[1],
    numberOfAssets
  );
  await testUser1.buyAssets(firstCurrency, secondCurrency, numberOfAssets);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const assetsSold = testUser1.getAsset(firstCurrency)?.amountAfter;
  const assetsBought = testUser1.getAsset(secondCurrency)?.amountAfter;

  expect(assetsSold?.free).bnEqual(
    testUser1.getAsset(firstCurrency)?.amountBefore.free.sub(sellPriceRpc)!
  );
  expect(assetsBought?.free).bnEqual(
    testUser1.getAsset(secondCurrency)?.amountBefore.free.add(numberOfAssets)!
  );
});
