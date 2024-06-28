/*
 *
 * @group xyk
 * @group accuracy
 * @group rewardsV2Parallel
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO, MangataInstance } from "gasp-sdk";
import { testLog } from "../../utils/Logger";
import { Sudo } from "../../utils/sudo";
import {
  activateLiquidity,
  burnLiquidity,
  createPool,
  getLiquidityAssetId,
  getRewardsInfo,
} from "../../utils/tx";
import { Xyk } from "../../utils/xyk";
import { waitForRewards } from "../../utils/eventListeners";
import { getSudoUser } from "../../utils/setup";

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

const defaultCurrencyValue = new BN(250000);
let mga: MangataInstance;

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "ethereum" });

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  testUser3 = new User(keyring);
  sudo = getSudoUser();

  //add two currencies and balance to testUser:
  [firstCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrencyValue, defaultCurrencyValue.add(new BN(1))],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
  );

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
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(firstCurrency, testUser2, default50k),
      Assets.mintToken(firstCurrency, testUser3, default50k),
    );
    testUser1.addAsset(firstCurrency);
    testUser2.addAsset(firstCurrency);
    testUser3.addAsset(firstCurrency);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    await testUser3.refreshAmounts(AssetWallet.BEFORE);
    mga = await getMangataInstance();

    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      default50k,
      MGA_ASSET_ID,
      default50k,
    );
  });
  test("Each user who minted owns the same % of tokens - one user gets extra token", async () => {
    const users = [testUser1, testUser2, testUser3];
    const sellAmount = new BN(1000);
    const balancesFirstCurrency = await mintAndBurnTokens(users, sellAmount, [
      default50k,
      default50k,
      default50k,
    ]);

    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrencyValue.sub(default50k))
      .add(sellAmount);
    const balancesWithCounts = getDuplicatedWithCounts(balancesFirstCurrency);
    const orderedKeys = Array.from(balancesWithCounts.keys()).sort((a, b) =>
      new BN(a).sub(new BN(b)).isNeg() ? -1 : 1,
    );
    // test that the two users got 1 token less than the other.
    expect(balancesWithCounts.get(orderedKeys[0])).toEqual(2);

    //two users must have the same balance, and other different.
    expect(Array.from(balancesWithCounts.values()).length).toBe(2);
    // the difference can not be larger than one.
    expect(
      new BN(Array.from(balancesWithCounts.keys())[0])
        .sub(new BN(Array.from(balancesWithCounts.keys())[1]))
        .abs(),
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
      .sub(defaultCurrencyValue.sub(default50k))
      .add(sellAmount);
    const balancesWithCounts = getDuplicatedWithCounts(balancesFirstCurrency);
    const orderedKeys = Array.from(balancesWithCounts.keys()).sort((a, b) =>
      new BN(a).sub(new BN(b)).isNeg() ? -1 : 1,
    );
    // test that the two users got 1 token more than the other.
    expect(balancesWithCounts.get(orderedKeys[1])).toEqual(2);
    //two users must have the same balance, and other different.
    expect(Array.from(balancesWithCounts.values()).length).toBe(2);
    //Difference can not be larger than one.
    expect(
      new BN(Array.from(balancesWithCounts.keys())[0])
        .sub(new BN(Array.from(balancesWithCounts.keys())[1]))
        .abs(),
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
      .sub(defaultCurrencyValue.sub(default50k))
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
      amountsToMint,
    );
    balancesFirstCurrency[0] = balancesFirstCurrency[0]
      .sub(defaultCurrencyValue.sub(default50k))
      .add(sellAmount);

    //lets remove the amount added to the user, so we only compare the benefits.
    balancesFirstCurrency.forEach((_, index) => {
      balancesFirstCurrency[index] =
        balancesFirstCurrency[index].sub(default50k);
    });
    testLog
      .getLog()
      .info(
        "Test user - 50k tokens get / 5" +
          balancesFirstCurrency[0].toNumber() / 5 +
          "\n" +
          "Test user - 20k tokens get / 2.5 " +
          (balancesFirstCurrency[1].toNumber() / 2.5).toString() +
          "\n" +
          "Test user - 50k tokens get " +
          balancesFirstCurrency[2].toNumber().toString(),
      );
    // worst case  [-1,-1,+2] - so the fifference in worst case is +2.
    expect(
      balancesFirstCurrency[0]
        .div(new BN(5))
        .sub(balancesFirstCurrency[1].mul(new BN(10)).div(new BN(25)))
        .abs(),
    ).bnLte(new BN(2));

    expect(
      balancesFirstCurrency[0]
        .div(new BN(5))
        .sub(balancesFirstCurrency[2])
        .abs(),
    ).bnLte(new BN(2));
  });
});

test("Given 3 users that minted liquidity WHEN only one activated the rewards THEN all rewards belongs to him on this pool", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser2, default50k),
    Assets.mintToken(firstCurrency, testUser3, default50k),
  );
  testUser1.addAsset(firstCurrency);
  testUser2.addAsset(firstCurrency);
  testUser3.addAsset(firstCurrency);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
  await testUser3.refreshAmounts(AssetWallet.BEFORE);
  mga = await getMangataInstance();

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    default50k,
    MGA_ASSET_ID,
    default50k,
  );

  const liqId = await getLiquidityAssetId(MGA_ASSET_ID, firstCurrency);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.mintLiquidity(firstCurrency, MGA_ASSET_ID, default50k),
    ),
    Assets.promotePool(liqId.toNumber(), 20),
  );

  testUser1.addAsset(liqId);
  testUser2.addAsset(liqId);
  testUser3.addAsset(liqId);

  await activateLiquidity(testUser2.keyRingPair, liqId, default50k);

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await testUser3.refreshAmounts(AssetWallet.AFTER);

  const rewardsUser1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId,
  );
  const rewardsUser2 = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqId,
  );
  const rewardsUser3 = await getRewardsInfo(
    testUser3.keyRingPair.address,
    liqId,
  );
  const mangata = await getMangataInstance(
    getEnvironmentRequiredVars().chainUri,
  );
  await waitForRewards(testUser2, liqId);
  const user1AvailableRewards = await mangata.rpc.calculateRewardsAmount({
    address: testUser1.keyRingPair.address,
    liquidityTokenId: liqId.toString(),
  });
  const user2AvailableRewards = await mangata.rpc.calculateRewardsAmount({
    address: testUser2.keyRingPair.address,
    liquidityTokenId: liqId.toString(),
  });
  const user3AvailableRewards = await mangata.rpc.calculateRewardsAmount({
    address: testUser3.keyRingPair.address,
    liquidityTokenId: liqId.toString(),
  });
  expect(rewardsUser1.activatedAmount).bnEqual(BN_ZERO);
  expect(rewardsUser2.activatedAmount).bnEqual(default50k);
  expect(rewardsUser3.activatedAmount).bnEqual(BN_ZERO);

  expect(user1AvailableRewards).bnEqual(BN_ZERO);
  expect(user2AvailableRewards).bnGt(BN_ZERO);
  expect(user3AvailableRewards).bnEqual(BN_ZERO);
});

///Mint tokens for all the users, users[0] do a swap and then all the users burn them all.
async function mintAndBurnTokens(
  users: User[],
  sellAmount: BN,
  amountToMint: BN[],
) {
  const liqToken = await mga.query.getLiquidityTokenId(
    firstCurrency.toString(),
    MGA_ASSET_ID.toString(),
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
    (user) => user.getFreeAssetAmount(liqToken).amountAfter.free! as BN,
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
  return users.map(
    (user) => user.getFreeAssetAmount(firstCurrency).amountAfter.free! as BN,
  );
}

async function burnAllLiquidities(users: User[], balances: BN[]) {
  await Promise.all([
    burnLiquidity(
      users[0].keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      balances[0],
    ),
    burnLiquidity(
      users[1].keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      balances[1],
    ),
    burnLiquidity(
      users[2].keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      balances[2],
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
