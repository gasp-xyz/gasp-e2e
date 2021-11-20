import { getApi, getMangataInstance, initApi } from "../../utils/api";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";

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
  });
  test("Each user who minted onws some % of tokens", async () => {
    const users = [testUser1, testUser2, testUser3];
    const mga = await getMangataInstance();

    await mga.createPool(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      default50k,
      MGA_ASSET_ID.toString(),
      default50k
    );
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
  });
});
