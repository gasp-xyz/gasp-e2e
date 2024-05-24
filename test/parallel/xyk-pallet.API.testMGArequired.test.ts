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
  createPool,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateAssetsWithValues } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { feeLockErrors, getEnvironmentRequiredVars } from "../../utils/utils";
import { Fees } from "../../utils/Fees";
import { mintLiquidity, sellAsset, buyAsset } from "../../utils/tx";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
const first_asset_amount = new BN(50000);
const second_asset_amount = new BN(50000);
//creating pool
const pool_balance_before = [new BN(0), new BN(0)];

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

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
  testLog.getLog().info(testUser1.keyRingPair.address);
  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );

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
});

describe("Wallets unmodified", () => {
  test("xyk-pallet - User Balance - Creating a pool requires paying fees", async () => {
    let exception = false;
    await expect(
      createPool(
        testUser1.keyRingPair,
        firstCurrency,
        first_asset_amount,
        secondCurrency,
        second_asset_amount,
      ).catch((reason) => {
        exception = true;
        throw new Error(reason.data);
      }),
    ).rejects.toThrow(feeLockErrors.AccountBalanceFail);
    expect(exception).toBeTruthy();
  });

  test("xyk-pallet - User Balance - mint liquidity requires paying fees", async () => {
    let exception = false;
    await expect(
      mintLiquidity(
        testUser1.keyRingPair,
        firstCurrency,
        secondCurrency,
        first_asset_amount,
        new BN(Number.MAX_SAFE_INTEGER),
      ).catch((reason) => {
        exception = true;
        throw new Error(reason.data);
      }),
    ).rejects.toThrow(feeLockErrors.AccountBalanceFail);
    expect(exception).toBeTruthy();
  });

  afterEach(async () => {
    const liquidity_asset_id = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    expect(liquidity_asset_id).bnEqual(new BN(-1));
    //validate
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    testUser1.getFreeAssetAmounts().forEach((asset) => {
      expect(asset.amountBefore.free).bnEqual(asset.amountAfter.free);
    });

    const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect([pool_balance_before[0], pool_balance_before[1]]).collectionBnEqual(
      pool_balance,
    );
    const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
    expect([pool_balance_before[0], pool_balance_before[1]]).collectionBnEqual([
      balance[1],
      balance[0],
    ]);
  });
});
test("xyk-pallet - User Balance - Selling an asset does not require paying fees", async () => {
  await sudo.mint(firstCurrency, sudo, defaultCurrecyValue);
  await sudo.mint(secondCurrency, sudo, defaultCurrecyValue);
  await sudo.createPoolToAsset(
    defaultCurrecyValue,
    defaultCurrecyValue,
    firstCurrency,
    secondCurrency,
  );
  //TODO:swapFees
  if (Fees.swapFeesEnabled) {
    await testUser1.addMGATokens(sudo);
  }
  let exception = false;
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const amountInWallet = testUser1.getAsset(firstCurrency)?.amountBefore!;
  const soldEvent = await sellAsset(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    amountInWallet.free.sub(new BN(1)),
    new BN(1),
  ).catch((reason) => {
    exception = true;
    throw new Error(reason);
  });
  expect(
    soldEvent.filter((event) => event.method === "AssetsSwapped"),
  ).toHaveLength(1);
  expect(exception).toBeFalsy();
});

test("xyk-pallet - User Balance - Buying an asset does not require paying fees", async () => {
  await sudo.mint(firstCurrency, sudo, defaultCurrecyValue);
  await sudo.mint(secondCurrency, sudo, defaultCurrecyValue);
  await sudo.createPoolToAsset(
    defaultCurrecyValue,
    defaultCurrecyValue,
    firstCurrency,
    secondCurrency,
  );
  //TODO:swapFees
  if (Fees.swapFeesEnabled) {
    await testUser1.addMGATokens(sudo);
  }
  let exception = false;
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const boughtEvent = await buyAsset(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(10000000),
  ).catch((reason) => {
    exception = true;
    throw new Error(reason.data);
  });
  expect(
    boughtEvent.filter((event) => event.method === "AssetsSwapped"),
  ).toHaveLength(1);
  expect(exception).toBeFalsy();
});
