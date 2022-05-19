/*
 *
 * @group xyk
 * @group api
 * @group sequential
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import {
  calculate_sell_price_id_rpc,
  calculate_sell_price_local_no_fee,
  getBalanceOfPool,
  getTreasury,
  getTreasuryBurn,
} from "../../utils/tx";
import { waitNewBlock } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getEnvironmentRequiredVars,
  getTokensDiffForBlockAuthor,
} from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Fees } from "../../utils/Fees";

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
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await waitNewBlock();
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  //add two curerncies and balance to testUser:
  [secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo
  );
  firstCurrency = MGA_ASSET_ID;

  await testUser1.addMGATokens(sudo);
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  testUser1.addAsset(firstCurrency, defaultCurrecyValue);

  await (
    await getMangataInstance()
  ).createPool(
    testUser1.keyRingPair,
    firstCurrency.toString(),
    firstAssetAmount,
    secondCurrency.toString(),
    secondAssetAmount
  );
});

test("xyk-pallet - Assets substracted are incremented by 1 - MGA- SellAsset", async () => {
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
  const treasuryBefore = await getTreasury(firstCurrency);
  const treasuryBurnBefore = await getTreasuryBurn(firstCurrency);
  const from = await getBlockNumber();
  await testUser1.sellAssets(firstCurrency, secondCurrency, sellingAmount);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  let tokensLost = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free.sub(
      testUser1.getAsset(firstCurrency)?.amountAfter.free!
    );

  const tokensWon = testUser1
    .getAsset(secondCurrency)
    ?.amountAfter.free.sub(
      testUser1.getAsset(secondCurrency)?.amountBefore.free!
    )!;
  let feesPaid = new BN(0);
  if (Fees.swapFeesEnabled) {
    const to = await getBlockNumber();
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      testUser1.keyRingPair.address
    );
    const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
    feesPaid = authorMGAtokens;
    tokensLost = tokensLost?.sub(feesPaid);
  }
  expect(tokensWon).bnEqual(tokensToReceive);
  expect(tokensLost).bnEqual(sellingAmount);
  expect(exangeValue).bnEqual(tokensWon);

  //0.05% = 5 tokens.
  const extraTokenForRounding = new BN(1);
  const expectedTreasury = new BN(5);
  const treasury = await getTreasury(firstCurrency);
  const treasuryBurn = await getTreasuryBurn(firstCurrency);
  const incrementedTreasury = treasuryBefore.sub(treasury).sub(feesPaid).abs();
  expect(incrementedTreasury).bnEqual(
    expectedTreasury.add(extraTokenForRounding)
  );
  expect(treasuryBurnBefore.sub(treasuryBurn)).bnEqual(treasuryBurnBefore);

  //the other pool_fee tokens must be in the pool.
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
  //adding treasury twice beacuse is burned.
  expect(
    poolBalance[0].add(incrementedTreasury).add(incrementedTreasury)
  ).bnEqual(firstAssetAmount.add(sellingAmount));
});

afterEach(async () => {});
