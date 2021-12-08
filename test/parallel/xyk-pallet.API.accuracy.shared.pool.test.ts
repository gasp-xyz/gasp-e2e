/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import {getApi, getMangataInstance, initApi} from "../../utils/api";
import BN from "bn.js";
import {Keyring} from "@polkadot/api";
import {AssetWallet, User} from "../../utils/User";
import {Assets} from "../../utils/Assets";
import {getEnvironmentRequiredVars} from "../../utils/utils";
import {MGA_ASSET_ID} from "../../utils/Constants";
import {Mangata} from "mangata-sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let testUser3: User;

let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
const default50k = new BN(50000);

//creating pool

const {sudo: sudoUserName} = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);
let mga: Mangata;

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({type: "sr25519"});

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  testUser3 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  //add two curerncies and balance to testUser:
  [firstCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo
  );
  //add zero MGA tokens.
  await testUser1.addMGATokens(sudo);
  await testUser2.addMGATokens(sudo);
  await testUser3.addMGATokens(sudo);
  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(testUser3.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  testUser1.addAsset(MGA_ASSET_ID);
  testUser2.addAsset(MGA_ASSET_ID);
  testUser3.addAsset(MGA_ASSET_ID);
  // check users accounts.
});

describe("Accuracy > Shared pool", () => {
  beforeEach(async () => {
    await sudo.mint(firstCurrency, testUser2, default50k);
    await sudo.mint(firstCurrency, testUser3, default50k);
    //    await Promise.all([
    //
    //    ]);
    testUser2.addAsset(firstCurrency);
    testUser3.addAsset(firstCurrency);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    await testUser3.refreshAmounts(AssetWallet.BEFORE);
    mga = await getMangataInstance();

    await mga.createPool(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      default50k,
      MGA_ASSET_ID.toString(),
      default50k
    );
  });
  test("Each user who minted onws the same % of tokens - one user gets extra token", async () => {
    const users = [testUser1, testUser2, testUser3];
    const sellAmount = new BN(1000);
    const balancesFirstCurrency = await mintAndBurnTokens(users, sellAmount, [
      default50k,
      default50k,
      default50k,
    ]);

    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrecyValue.sub(default50k))
      .add(sellAmount);
    const balancesWithCounts = getDuplicatedWithCounts(balancesFirstCurrency);
    const orderedKeys = Array.from(balancesWithCounts.keys()).sort((a, b) =>
      new BN(a).sub(new BN(b)).isNeg() ? -1 : 1
    );
    // test that the two users got 1 token less than the other.
    expect(balancesWithCounts.get(orderedKeys[0])).toEqual(2);

    //two users must have the same balance, and other different.
    expect(Array.from(balancesWithCounts.values()).length).toBe(2);
    // the difference can not be larger than one.
    expect(
      new BN(Array.from(balancesWithCounts.keys())[0])
        .sub(new BN(Array.from(balancesWithCounts.keys())[1]))
        .abs()
    ).bnEqual(new BN(1));
  });
  test("Each user who minted onws the same % of tokens - two users gets the extra", async () => {
    const users = [testUser1, testUser2, testUser3];
    const sellAmount = new BN(1001);
    const balancesFirstCurrency = await mintAndBurnTokens(users, sellAmount, [
      default50k,
      default50k,
      default50k,
    ]);

    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrecyValue.sub(default50k))
      .add(sellAmount);
    const balancesWithCounts = getDuplicatedWithCounts(balancesFirstCurrency);
    const orderedKeys = Array.from(balancesWithCounts.keys()).sort((a, b) =>
      new BN(a).sub(new BN(b)).isNeg() ? -1 : 1
    );
    // test that the two users got 1 token more than the other.
    expect(balancesWithCounts.get(orderedKeys[1])).toEqual(2);
    //two users must have the same balance, and other different.
    expect(Array.from(balancesWithCounts.values()).length).toBe(2);
    //Difference can not be larger than one.
    expect(
      new BN(Array.from(balancesWithCounts.keys())[0])
        .sub(new BN(Array.from(balancesWithCounts.keys())[1]))
        .abs()
    ).bnEqual(new BN(1));
  });
  test("Each user who minted onws the same % of tokens - divisible by 3", async () => {
    const users = [testUser1, testUser2, testUser3];
    const sellAmount = new BN(1002);
    const balancesFirstCurrency = await mintAndBurnTokens(users, sellAmount, [
      default50k,
      default50k,
      default50k,
    ]);

    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrecyValue.sub(default50k))
      .add(sellAmount);

    const balancesWithCounts = getDuplicatedWithCounts(balancesFirstCurrency);

    expect(balancesFirstCurrency[1]).bnEqual(balancesFirstCurrency[2]);
    expect(balancesFirstCurrency[1]).bnEqual(balancesFirstCurrency[0]);
    expect(Array.from(balancesWithCounts).length).toEqual(1);
  });
  test("Each user who minted different % of tokens [50k,25k,5k]- get diff amounts", async () => {
    const users = [testUser1, testUser2, testUser3];
    const sellAmount = new BN(1002);
    const amountsToMint = [
      default50k,
      default50k.div(new BN(2)),
      default50k.div(new BN(5)),
    ];

    const balancesFirstCurrency = await mintAndBurnTokens(
      users,
      sellAmount,
      amountsToMint
    );
    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrecyValue.sub(default50k))
      .add(sellAmount);

    //lets remove the amount added to the user, so we only compare the benefits.
    balancesFirstCurrency.forEach((_, index) => {
      balancesFirstCurrency[index] =
        balancesFirstCurrency[index].sub(default50k);
    });
    // test that the difference is not larger than one.1x - 2z
    expect(
      balancesFirstCurrency[0]
        .sub(balancesFirstCurrency[1].mul(new BN(2)))
        .abs()
    ).bnLte(new BN(1));

    // test that the difference is not larger than one. 1x = 5y
    expect(
      balancesFirstCurrency[0]
        .sub(balancesFirstCurrency[2].mul(new BN(5)))
        .abs()
    ).bnLte(new BN(1));
  });
});

///Mint tokens for all the users, users[0] do a swap and then all the users burn them all.
async function mintAndBurnTokens(
  users: User[],
  sellAmount: BN,
  amountToMint: BN[]
) {
  const liqToken = await mga.getLiquidityAssetId(
    firstCurrency.toString(),
    MGA_ASSET_ID.toString()
  );
  users.forEach((user) => user.addAsset(liqToken));
  testUser3.addAsset(firstCurrency);
  await Promise.all([
    testUser2.mintLiquidity(firstCurrency, MGA_ASSET_ID, amountToMint[1]),
    testUser3.mintLiquidity(firstCurrency, MGA_ASSET_ID, amountToMint[2]),
  ]);
  // now pool is[user1-33%, user2-33%, user3-33%]
  await Promise.all([
    await users[0].refreshAmounts(AssetWallet.AFTER),
    await users[1].refreshAmounts(AssetWallet.AFTER),
    await users[2].refreshAmounts(AssetWallet.AFTER),
  ]);
  const balancesLiqToken = users.map(
    (user) => user.getFreeAssetAmount(liqToken).amountAfter.free! as BN
  );
  //pool is perfectly balance
  expect(balancesLiqToken[0]).bnEqual(amountToMint[0]);
  expect(balancesLiqToken[1]).bnEqual(amountToMint[1]);
  expect(balancesLiqToken[2]).bnEqual(amountToMint[2]);

  await testUser1.sellAssets(firstCurrency, MGA_ASSET_ID, sellAmount);

  await burnAllLiquidities(users, balancesLiqToken);
  await Promise.all([
    await users[0].refreshAmounts(AssetWallet.AFTER),
    await users[1].refreshAmounts(AssetWallet.AFTER),
    await users[2].refreshAmounts(AssetWallet.AFTER),
  ]);
  const balancesFirstCurrency = users.map(
    (user) => user.getFreeAssetAmount(firstCurrency).amountAfter.free! as BN
  );
  return balancesFirstCurrency;
}

async function burnAllLiquidities(users: User[], balances: BN[]) {
  await Promise.all([
    mga.burnLiquidity(
      users[0].keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      balances[0]
    ),
    mga.burnLiquidity(
      users[1].keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      balances[1]
    ),
    mga.burnLiquidity(
      users[2].keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      balances[2]
    ),
  ]);
}

const getDuplicatedWithCounts = (list: BN[]) => {
  const counts: Map<string, number> = new Map();
  list.forEach(function (x) {
    counts.set(x.toString(), (counts.get(x.toString()) || 0) + 1);
  });
  return counts;
};
