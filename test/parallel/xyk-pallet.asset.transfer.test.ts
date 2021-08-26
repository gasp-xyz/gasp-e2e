import { getApi, initApi } from "../../utils/api";
import { getBalanceOfPool, transferAll, transferAsset } from "../../utils/tx";
import { waitNewBlock, ExtrinsicResult } from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import {
  validateAssetsWithValues,
  validateEmptyAssets,
} from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromTxWait } from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
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
});

beforeEach(async () => {
  await waitNewBlock();
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
    sudo
  );
  await testUser1.addMGATokens(sudo);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(pallet.keyRingPair);

  // check users accounts.
  await waitNewBlock();
  pallet.addAssets([firstCurrency, secondCurrency]);
  testUser2.addAssets([firstCurrency, secondCurrency]);
  await pallet.refreshAmounts(AssetWallet.BEFORE);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);

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
  validateEmptyAssets([
    testUser2.getAsset(firstCurrency)?.amountBefore!,
    testUser2.getAsset(secondCurrency)?.amountBefore!,
  ]);
});

test("xyk-pallet - AssetsOperation: transferAsset", async () => {
  //Refactor Note: [Missing Wallet assert?] Did not considered creating a liquity asset. Transaction does nothing with it.
  const pool_balance_before = await getBalanceOfPool(
    firstCurrency,
    secondCurrency
  );
  const amount = new BN(100000);
  testLog
    .getLog()
    .info("testUser1: transfering asset " + firstCurrency + " to testUser2");

  await transferAsset(
    testUser1.keyRingPair,
    firstCurrency,
    testUser2.keyRingPair.address,
    amount
  ).then((result) => {
    const eventResponse = getEventResultFromTxWait(result, [
      "tokens",
      "Transferred",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  testUser1.validateWalletReduced(firstCurrency, amount);
  testUser1.validateWalletIncreased(secondCurrency, new BN(0));

  testUser2.validateWalletIncreased(firstCurrency, amount);
  testUser1.validateWalletIncreased(secondCurrency, new BN(0));

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect(pool_balance_before).toEqual(pool_balance);
});

test("xyk-pallet - AssetsOperation: transferAll", async () => {
  //Refactor Note: [Missing Wallet assert?] Did not considered creating a liquity asset. Transaction does nothing with it.
  const pool_balance_before = await getBalanceOfPool(
    firstCurrency,
    secondCurrency
  );
  const amount = testUser1.getAsset(firstCurrency)?.amountBefore!;
  testLog
    .getLog()
    .debug(
      "testUser1: transfering all assets " + firstCurrency + " to testUser2"
    );

  await transferAll(
    testUser1.keyRingPair,
    firstCurrency,
    testUser2.keyRingPair.address
  ).then((result) => {
    const eventResponse = getEventResultFromTxWait(result, [
      "tokens",
      "Transferred",
      testUser1.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);
  await pallet.refreshAmounts(AssetWallet.AFTER);

  testUser1.validateWalletReduced(firstCurrency, amount);
  testUser1.validateWalletIncreased(secondCurrency, new BN(0));

  testUser2.validateWalletIncreased(firstCurrency, amount);
  testUser1.validateWalletIncreased(secondCurrency, new BN(0));

  const pool_balance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect(pool_balance_before).toEqual(pool_balance);
});
