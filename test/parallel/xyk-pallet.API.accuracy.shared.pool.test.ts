import { getApi, getMangataInstance, initApi } from "../../utils/api";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Mangata } from "mangata-sdk";

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

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);
let mga: Mangata;

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

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
  test("Each user who minted onws the same % of tokens - last user gets extra token", async () => {
    const users = [testUser1, testUser2, testUser3];
    const liqToken = await mga.getLiquidityAssetId(
      firstCurrency.toString(),
      MGA_ASSET_ID.toString()
    );
    users.forEach((user) => user.addAsset(liqToken));
    testUser3.addAsset(firstCurrency);
    await Promise.all([
      testUser2.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
      testUser3.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
    ]);
    // now pool is[user1-33%, user2-33%, user3-33%]
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balances = users.map(
      (user) => user.getFreeAssetAmount(liqToken).amountAfter.free! as BN
    );
    expect(balances[0]).bnEqual(balances[1]);
    expect(balances[1]).bnEqual(balances[2]);
    expect(balances[1]).bnEqual(default50k);
    await testUser1.sellAssets(firstCurrency, MGA_ASSET_ID, new BN(1000));

    await burnAllLiquidities(users, balances);
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balancesFirstCurrency = users.map(
      (user) => user.getFreeAssetAmount(firstCurrency).amountAfter.free! as BN
    );
    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrecyValue.sub(default50k))
      .add(new BN(1000));
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
  test("Each user who minted onws the same % of tokens - two last users gets the extra", async () => {
    const users = [testUser1, testUser2, testUser3];
    const liqToken = await mga.getLiquidityAssetId(
      firstCurrency.toString(),
      MGA_ASSET_ID.toString()
    );
    users.forEach((user) => user.addAsset(liqToken));
    testUser3.addAsset(firstCurrency);
    await Promise.all([
      testUser2.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
      testUser3.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
    ]);
    // now pool is[user1-33%, user2-33%, user3-33%]
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balances = users.map(
      (user) => user.getFreeAssetAmount(liqToken).amountAfter.free! as BN
    );
    expect(balances[0]).bnEqual(balances[1]);
    expect(balances[1]).bnEqual(balances[2]);
    expect(balances[1]).bnEqual(default50k);
    await testUser1.sellAssets(firstCurrency, MGA_ASSET_ID, new BN(1001));

    await burnAllLiquidities(users, balances);
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balancesFirstCurrency = users.map(
      (user) => user.getFreeAssetAmount(firstCurrency).amountAfter.free! as BN
    );
    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrecyValue.sub(default50k))
      .add(new BN(1001));
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
  test.skip("TODO:Each user who minted onws the same % of tokens - divisible by 3", async () => {
    const users = [testUser1, testUser2, testUser3];
    const liqToken = await mga.getLiquidityAssetId(
      firstCurrency.toString(),
      MGA_ASSET_ID.toString()
    );
    users.forEach((user) => user.addAsset(liqToken));
    testUser3.addAsset(firstCurrency);
    await Promise.all([
      testUser2.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
      testUser3.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
    ]);
    // now pool is[user1-33%, user2-33%, user3-33%]
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balances = users.map(
      (user) => user.getFreeAssetAmount(liqToken).amountAfter.free! as BN
    );
    expect(balances[0]).bnEqual(balances[1]);
    expect(balances[1]).bnEqual(balances[2]);
    expect(balances[1]).bnEqual(default50k);
    await testUser1.sellAssets(firstCurrency, MGA_ASSET_ID, new BN(1003));

    await burnAllLiquidities(users, balances);
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balancesFirstCurrency = users.map(
      (user) => user.getFreeAssetAmount(firstCurrency).amountAfter.free! as BN
    );
    expect(balancesFirstCurrency[1]).bnEqual(balancesFirstCurrency[2]);
    //we want to exract from user0, who gets 250k tokens, the equivalent of the rest of the users
    // user has: 250nnn - (250000 - 50000) = 50nnn, that must be equals to other users balances.
    expect(balancesFirstCurrency[1]).bnEqual(
      balancesFirstCurrency[0]
        .sub(defaultCurrecyValue.sub(default50k))
        .add(new BN(1000)) // user1 has 1000 less tokens from the swap!,
        .sub(new BN(1)) //,last token for the last one burning?
    );
  });
  test.skip("TODO:Each user who minted different % of tokens [50k,25k,5k]- divisible by 3", async () => {
    const users = [testUser1, testUser2, testUser3];
    const liqToken = await mga.getLiquidityAssetId(
      firstCurrency.toString(),
      MGA_ASSET_ID.toString()
    );
    users.forEach((user) => user.addAsset(liqToken));
    testUser3.addAsset(firstCurrency);
    await Promise.all([
      testUser2.mintLiquidity(
        firstCurrency,
        MGA_ASSET_ID,
        default50k.div(new BN(2))
      ),
      testUser3.mintLiquidity(
        firstCurrency,
        MGA_ASSET_ID,
        default50k.div(new BN(5))
      ),
    ]);
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balances = users.map(
      (user) => user.getFreeAssetAmount(liqToken).amountAfter.free! as BN
    );
    expect(balances[0]).bnEqual(balances[1].mul(new BN(2)));
    expect(balances[1]).bnEqual(balances[2]);
    expect(balances[1]).bnEqual(default50k);
    await testUser1.sellAssets(firstCurrency, MGA_ASSET_ID, new BN(1003));

    await burnAllLiquidities(users, balances);
    await Promise.all([
      await users[0].refreshAmounts(AssetWallet.AFTER),
      await users[1].refreshAmounts(AssetWallet.AFTER),
      await users[2].refreshAmounts(AssetWallet.AFTER),
    ]);
    const balancesFirstCurrency = users.map(
      (user) => user.getFreeAssetAmount(firstCurrency).amountAfter.free! as BN
    );
    expect(balancesFirstCurrency[1]).bnEqual(balancesFirstCurrency[2]);
    //we want to exract from user0, who gets 250k tokens, the equivalent of the rest of the users
    // user has: 250nnn - (250000 - 50000) = 50nnn, that must be equals to other users balances.
    expect(balancesFirstCurrency[1]).bnEqual(
      balancesFirstCurrency[0]
        .sub(defaultCurrecyValue.sub(default50k))
        .add(new BN(1000)) // user1 has 1000 less tokens from the swap!,
        .sub(new BN(1)) //,last token for the last one burning?
    );
  });
});
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
