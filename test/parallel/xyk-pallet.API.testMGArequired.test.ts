/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { getBalanceOfPool, getLiquidityAssetId } from "../../utils/tx";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateAssetsWithValues } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MAX_BALANCE } from "../../utils/Constants";

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

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo
  );
  //add zero MGA tokens.
  await testUser1.addMGATokens(sudo, new BN(0));
  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);

  // check users accounts.
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  validateAssetsWithValues(
    [
      testUser1.getAsset(firstCurrency)?.amountBefore!,
      testUser1.getAsset(secondCurrency)?.amountBefore!,
    ],
    [
      defaultCurrecyValue.toNumber(),
      defaultCurrecyValue.add(new BN(1)).toNumber(),
    ]
  );
});

describe("Wallets unmodified", () => {
  test("xyk-pallet - User Balance - Creating a pool requires paying fees", async () => {
    let exception = false;
    const mangata = await getMangataInstance();
    await expect(
      mangata
        .createPool(
          testUser1.keyRingPair,
          firstCurrency.toString(),
          first_asset_amount,
          secondCurrency.toString(),
          second_asset_amount
        )
        .catch((reason) => {
          exception = true;
          throw new Error(reason.data);
        })
    ).rejects.toThrow(
      "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low"
    );
    expect(exception).toBeTruthy();
  });

  test("xyk-pallet - User Balance - mint liquidity requires paying fees", async () => {
    let exception = false;
    const mangata = await getMangataInstance();
    await expect(
      mangata
        .mintLiquidity(
          testUser1.keyRingPair,
          firstCurrency.toString(),
          secondCurrency.toString(),
          first_asset_amount,
          new BN(Number.MAX_SAFE_INTEGER)
        )
        .catch((reason) => {
          exception = true;
          throw new Error(reason.data);
        })
    ).rejects.toThrow(
      "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low"
    );
    expect(exception).toBeTruthy();
  });

  afterEach(async () => {
    const liquidity_asset_id = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency
    );
    expect(liquidity_asset_id).bnEqual(new BN(-1));
    //validate
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    testUser1.assets.forEach((asset) => {
      expect(asset.amountBefore).bnEqual(asset.amountAfter);
    });

    const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
    expect([pool_balance_before[0], pool_balance_before[1]]).toEqual(
      pool_balance
    );
    const balance = await getBalanceOfPool(secondCurrency, firstCurrency);
    expect([pool_balance_before[0], pool_balance_before[1]]).toEqual([
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
    secondCurrency
  );

  let exception = false;
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const amountInWallet = testUser1.getAsset(firstCurrency)?.amountBefore!;
  const mangata = await getMangataInstance();
  const soldEvent = await mangata
    .sellAsset(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      secondCurrency.toString(),
      amountInWallet.sub(new BN(1)),
      new BN(1)
    )
    .catch((reason) => {
      exception = true;
      throw new Error(reason);
    });
  expect(soldEvent[0].method).toEqual("AssetsSwapped");
  expect(exception).toBeFalsy();
});

test("xyk-pallet - User Balance - Buying an asset does not require paying fees", async () => {
  await sudo.mint(firstCurrency, sudo, defaultCurrecyValue);
  await sudo.mint(secondCurrency, sudo, defaultCurrecyValue);
  await sudo.createPoolToAsset(
    defaultCurrecyValue,
    defaultCurrecyValue,
    firstCurrency,
    secondCurrency
  );

  let exception = false;
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const amountInWallet = testUser1.getAsset(firstCurrency)?.amountBefore!;
  const mangata = await getMangataInstance();
  const boughtEvent = await mangata
    .buyAsset(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      secondCurrency.toString(),
      MAX_BALANCE,
      amountInWallet
    )
    .catch((reason) => {
      exception = true;
      throw new Error(reason.data);
    });
  expect(boughtEvent[0].method).toEqual("AssetsSwapped");
  expect(exception).toBeFalsy();
});
