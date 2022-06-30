/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { initApi, mangata } from "../../utils/api";
import {
  calculate_sell_price_id_rpc,
  calculate_sell_price_local_no_fee, createPool,
  getBalanceOfPool,
  getNextAssetId,
  getTreasury,
  getTreasuryBurn,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateAssetsWithValues } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ONE } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(50000);
//creating pool

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

beforeEach(async () => {
  await initApi();

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  sudo = new User(keyring, sudoUserName);
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);

  //add two curerncies and balance to testUser:
  firstCurrency = await getNextAssetId();
  secondCurrency = firstCurrency.add(BN_ONE);

  await Promise.all([
    testUser1.addMGATokens(sudo),
    Assets.setupUserWithCurrency(
      testUser1,
      firstCurrency,
      defaultCurrecyValue,
      sudo
    ),
    Assets.setupUserWithCurrency(
      testUser1,
      secondCurrency,
      defaultCurrecyValue.add(BN_ONE),
      sudo
    ),
  ]);

  testUser1.addAsset(MGA_ASSET_ID);
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
    ]
  );
  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    firstAssetAmount,
    secondCurrency,
    secondAssetAmount
  );
});

test("xyk-pallet - Assets substracted are incremented by 1 - SellAsset", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const sellingAmount = new BN(10000);
  const tokensToReceive = await calculate_sell_price_id_rpc(
    firstCurrency,
    secondCurrency,
    sellingAmount
  );

  //10000 - 0.3% = 9970.
  //selling the amount without the fee.
  const exangeValue = await calculate_sell_price_local_no_fee(
    secondAssetAmount,
    firstAssetAmount,
    new BN(9970)
  );
  await testUser1.sellAssets(firstCurrency, secondCurrency, sellingAmount);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const tokensLost = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free.sub(
      testUser1.getAsset(firstCurrency)?.amountAfter.free!
    );

  const tokensWon = testUser1
    .getAsset(secondCurrency)
    ?.amountAfter.free.sub(
      testUser1.getAsset(secondCurrency)?.amountBefore.free!
    )!;

  expect(tokensWon).bnEqual(tokensToReceive);
  expect(tokensLost).bnEqual(sellingAmount);
  expect(exangeValue).bnEqual(tokensWon);

  //0.05% = 5 tokens.
  const extraTokenForRounding = new BN(1);
  const expectedTreasury = new BN(5);
  const treasury = await getTreasury(firstCurrency);
  const treasuryBurn = await getTreasuryBurn(firstCurrency);
  expect(treasury).bnEqual(expectedTreasury.add(extraTokenForRounding));
  expect(treasuryBurn).bnEqual(expectedTreasury.add(extraTokenForRounding));

  //the other pool_fee tokens must be in the pool.
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
  expect(poolBalance[0].add(treasury).add(treasuryBurn)).bnEqual(
    firstAssetAmount.add(sellingAmount)
  );
});

afterEach(async () => {});
