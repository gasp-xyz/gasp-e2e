/*
 *
 * @group xyk
 * @group asset
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getBalanceOfPool, transferAll, transferAsset } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateAssetsWithValues,
  validateEmptyAssets,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { testLog } from "../../utils/Logger";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  EVENT_SECTION_PAYMENT,
  EVENT_METHOD_PAYMENT,
} from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let pallet: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;

const { xykPalletAddress: pallet_address, sudo: sudoUserName } =
  getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

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
  testUser2 = new User(keyring);
  const sudo = new User(keyring, sudoUserName);

  // setup Pallet.
  pallet = new User(keyring);
  pallet.addFromAddress(keyring, pallet_address);

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );
  await testUser1.addMGATokens(sudo);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(pallet.keyRingPair);

  // check users accounts.

  pallet.addAssets([firstCurrency, secondCurrency]);
  testUser2.addAssets([firstCurrency, secondCurrency]);
  await pallet.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);

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
  validateEmptyAssets([
    testUser2.getAsset(firstCurrency)?.amountBefore.free!,
    testUser2.getAsset(secondCurrency)?.amountBefore.free!,
  ]);
});

test("xyk-pallet - AssetsOperation: transferAsset", async () => {
  //Refactor Note: [Missing Wallet assert?] Did not considered creating a liquity asset. Transaction does nothing with it.
  const pool_balance_before = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );
  const amount = new BN(100000);
  testLog
    .getLog()
    .info("testUser1: transfering asset " + firstCurrency + " to testUser2");

  await transferAsset(
    testUser1.keyRingPair,
    firstCurrency,
    testUser2.keyRingPair.address,
    amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "tokens",
      "Transfer",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    expect(
      result.findIndex(
        (x) =>
          x.section === EVENT_SECTION_PAYMENT ||
          x.method === EVENT_METHOD_PAYMENT,
      ),
    ).toBeGreaterThan(-1);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  const diffFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(amount);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  let addFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.add(new BN(0));
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  addFromWallet = testUser2
    .getAsset(firstCurrency)
    ?.amountBefore.free!.add(amount);
  expect(testUser2.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  addFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.add(new BN(0));
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect(pool_balance_before).toEqual(pool_balance);
});

test("xyk-pallet - AssetsOperation: transferAll", async () => {
  //Refactor Note: [Missing Wallet assert?] Did not considered creating a liquity asset. Transaction does nothing with it.
  const pool_balance_before = await getBalanceOfPool(
    firstCurrency,
    secondCurrency,
  );
  const amount = testUser1.getAsset(firstCurrency)?.amountBefore!;
  testLog
    .getLog()
    .debug(
      "testUser1: transfering all assets " + firstCurrency + " to testUser2",
    );

  await transferAll(
    testUser1.keyRingPair,
    firstCurrency,
    testUser2.keyRingPair.address,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "tokens",
      "Transfer",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  const diffFromWallet = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free!.sub(amount.free);
  expect(testUser1.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    diffFromWallet!,
  );

  let addFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.add(new BN(0));
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  addFromWallet = testUser2
    .getAsset(firstCurrency)
    ?.amountBefore.free!.add(amount.free);
  expect(testUser2.getAsset(firstCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  addFromWallet = testUser1
    .getAsset(secondCurrency)
    ?.amountBefore.free!.add(new BN(0));
  expect(testUser1.getAsset(secondCurrency)?.amountAfter.free!).bnEqual(
    addFromWallet!,
  );

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect(pool_balance_before).collectionBnEqual(pool_balance);
});
