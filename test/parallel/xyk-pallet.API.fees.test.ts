/*
 * @group parallel
 * @group api
 *
 */

import { getApi, initApi } from "../../utils/api";
import {
  burnLiquidity,
  createPool,
  mintLiquidity,
  transferAll,
  transferAsset,
} from "../../utils/tx";
import { waitNewBlock } from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars, MGA_ASSET_ID } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let sudo: User;
let pallet: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;

const { pallet: pallet_address, sudo: sudoUserName } =
  getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await waitNewBlock();
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  // setup Pallet.
  pallet = new User(keyring);
  pallet.addFromAddress(keyring, pallet_address);
  pallet.addAsset(MGA_ASSET_ID);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(pallet.keyRingPair);

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo
  );
  //add zero MGA tokens.
  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);
  await testUser2.addMGATokens(sudo);
  testUser2.addAsset(MGA_ASSET_ID);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    new BN(1000),
    secondCurrency,
    new BN(1000)
  );
  // check users accounts.
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
});

beforeEach(async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await pallet.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-pallet - MGA tokens are substracted as fee : CreatePool", async () => {
  const [thirdCurrency, fourthCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo
  );
  await createPool(
    testUser1.keyRingPair,
    thirdCurrency,
    new BN(1000),
    fourthCurrency,
    new BN(100)
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(MGA_ASSET_ID)!;
  const diff =
    mgaUserToken.amountBefore.toNumber() - mgaUserToken.amountAfter.toNumber();
  expect(diff).toBeGreaterThan(0);
  pallet.validateWalletIncreased(MGA_ASSET_ID, new BN(diff));
});
test("xyk-pallet - MGA tokens are substracted as fee : MintLiquidity", async () => {
  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(1000)
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(MGA_ASSET_ID)!;
  const diff =
    mgaUserToken.amountBefore.toNumber() - mgaUserToken.amountAfter.toNumber();
  expect(diff).toBeGreaterThan(0);
  pallet.validateWalletIncreased(MGA_ASSET_ID, new BN(diff));
});
test("xyk-pallet - MGA tokens are substracted as fee : BurnLiquidity", async () => {
  await burnLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(1000)
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(MGA_ASSET_ID)!;
  const diff =
    mgaUserToken.amountBefore.toNumber() - mgaUserToken.amountAfter.toNumber();
  expect(diff).toBeGreaterThan(0);
  pallet.validateWalletIncreased(MGA_ASSET_ID, new BN(diff));
});
test("xyk-pallet - MGA tokens are substracted as fee : Transfer", async () => {
  await transferAsset(
    testUser1.keyRingPair,
    firstCurrency,
    testUser2.keyRingPair.address,
    new BN(1000)
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(MGA_ASSET_ID)!;
  const diff =
    mgaUserToken.amountBefore.toNumber() - mgaUserToken.amountAfter.toNumber();
  expect(diff).toBeGreaterThan(0);
  pallet.validateWalletIncreased(MGA_ASSET_ID, new BN(diff));
});
test("xyk-pallet - MGA tokens are substracted as fee : TransferAll", async () => {
  await sudo.mint(firstCurrency, testUser2, new BN(1000));
  await transferAll(
    testUser2.keyRingPair,
    firstCurrency,
    testUser1.keyRingPair.address
  );
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser2.getAsset(MGA_ASSET_ID)!;
  const diff =
    mgaUserToken.amountBefore.toNumber() - mgaUserToken.amountAfter.toNumber();
  expect(diff).toBeGreaterThan(0);
  pallet.validateWalletIncreased(MGA_ASSET_ID, new BN(diff));
});
test("xyk-pallet - MGA tokens are not substracted as fee : SellAsset", async () => {
  await testUser1.sellAssets(firstCurrency, secondCurrency, new BN(50));
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(MGA_ASSET_ID)!;
  const diff =
    mgaUserToken.amountBefore.toNumber() - mgaUserToken.amountAfter.toNumber();
  expect(diff).toBe(0);
  expect(
    testUser1.getAsset(firstCurrency)!.amountBefore.toNumber()
  ).toBeLessThan(testUser1.getAsset(MGA_ASSET_ID)!.amountAfter.toNumber());
  pallet.validateWalletIncreased(MGA_ASSET_ID, new BN(0));
});
test("xyk-pallet - MGA tokens are not substracted as fee : BuyAsset", async () => {
  await testUser1.buyAssets(firstCurrency, secondCurrency, new BN(50));
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(MGA_ASSET_ID)!;
  const diff =
    mgaUserToken.amountBefore.toNumber() - mgaUserToken.amountAfter.toNumber();
  expect(diff).toBe(0);
  expect(
    testUser1.getAsset(firstCurrency)!.amountBefore.toNumber()
  ).toBeGreaterThan(testUser1.getAsset(firstCurrency)!.amountAfter.toNumber());
  pallet.validateWalletIncreased(MGA_ASSET_ID, new BN(0));
});
