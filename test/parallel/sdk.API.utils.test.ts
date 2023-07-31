/*
 *
 * @group sdk
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { multiSwapBuy, multiSwapSell } from "../../utils/tx";
import {
  BN_TEN,
  BN_TEN_THOUSAND,
  isBuyAssetTransactionSuccessful,
  isSellAssetTransactionSuccessful,
} from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );
});

beforeEach(async () => {
  testUser1 = new User(keyring);
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintToken(token1, testUser1, BN_TEN_THOUSAND)
  );
});

test("isBuyAssetTransactionSuccessful returns a true flag", async () => {
  const tokenIds = [MGA_ASSET_ID, token1];

  const multiSwapOutput = await multiSwapBuy(
    testUser1,
    tokenIds,
    new BN(1000),
    BN_TEN_THOUSAND
  );

  const success = isBuyAssetTransactionSuccessful(multiSwapOutput);

  expect(success).toEqual(true);
});

test("isBuyAssetTransactionSuccessful returns a false flag", async () => {
  const tokenIds = [MGA_ASSET_ID, token1];

  const multiSwapOutput = await multiSwapBuy(
    testUser1,
    tokenIds,
    new BN(1000),
    BN_TEN
  );

  const success = isBuyAssetTransactionSuccessful(multiSwapOutput);

  expect(success).toEqual(false);
});

test("isSellAssetTransactionSuccessful returns a true flag", async () => {
  const tokenIds = [MGA_ASSET_ID, token1];

  const multiSwapOutput = await multiSwapSell(
    testUser1,
    tokenIds,
    new BN(1000)
  );

  const success = isSellAssetTransactionSuccessful(multiSwapOutput);

  expect(success).toEqual(true);
});

test("isSellAssetTransactionSuccessful returns a false flag", async () => {
  const tokenIds = [MGA_ASSET_ID, token1];

  const multiSwapOutput = await multiSwapSell(
    testUser1,
    tokenIds,
    new BN(1000),
    BN_TEN_THOUSAND
  );

  const success = isSellAssetTransactionSuccessful(multiSwapOutput);

  expect(success).toEqual(false);
});

// test("isBuyAssetTransactionSuccessful returns empty flag in multiSwapSell", async () => {
//   const tokenIds = [MGA_ASSET_ID, token1];

//   const multiSwapOutput = await multiSwapSell(
//     testUser1,
//     tokenIds,
//     new BN(1000)
//   );

//   const success = isBuyAssetTransactionSuccessful(multiSwapOutput);

//   expect(success).toBeEmpty();
// });
