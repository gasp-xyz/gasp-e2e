/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group xyk
 * @group api
 * @group sequential
 * @group critical
 */
import { initApi } from "../../utils/api";
import {
  burnLiquidity,
  createPool,
  getNextAssetId,
  mintLiquidity,
  transferAll,
  transferAsset,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getEnvironmentRequiredVars,
  getTokensDiffForBlockAuthor,
  waitIfSessionWillChangeInNblocks,
} from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Fees } from "../../utils/Fees";
import { BN_ONE } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

beforeAll(async () => {
  await initApi();

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);

  //add two curerncies and balance to testUser:
  firstCurrency = await getNextAssetId();
  secondCurrency = firstCurrency.add(BN_ONE);

  await Promise.all([
    testUser1.addMGATokens(sudo),
    testUser2.addMGATokens(sudo),
    Assets.setupUserWithCurrency(
      testUser1,
      firstCurrency,
      defaultCurrecyValue,
      sudo
    ),
    Assets.setupUserWithCurrency(
      testUser1,
      secondCurrency,
      defaultCurrecyValue.add(new BN(1)),
      sudo
    ),
  ]);
  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    new BN(1000),
    secondCurrency,
    new BN(1000)
  );

  testUser1.addAsset(MGA_ASSET_ID);
  testUser2.addAsset(MGA_ASSET_ID);
});

beforeEach(async () => {
  await waitIfSessionWillChangeInNblocks(7);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-pallet - MGA tokens are substracted as fee : CreatePool", async () => {
  const thirdCurrency = await getNextAssetId();
  const fourthCurrency = thirdCurrency.add(BN_ONE);

  const from = await getBlockNumber();
  await Promise.all([
    Assets.setupUserWithCurrency(
      testUser1,
      thirdCurrency,
      defaultCurrecyValue,
      sudo
    ),
    Assets.setupUserWithCurrency(
      testUser1,
      thirdCurrency,
      defaultCurrecyValue.add(BN_ONE),
      sudo
    ),
    createPool(
      testUser1.keyRingPair,
      thirdCurrency,
      new BN(1000),
      fourthCurrency,
      new BN(100)
    ),
  ]);
  const to = await getBlockNumber();
  await checkFee(from, to, testUser1);
});

test("xyk-pallet - MGA tokens are substracted as fee : MintLiquidity", async () => {
  const from = await getBlockNumber();
  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(1000)
  );
  const to = await getBlockNumber();
  await checkFee(from, to, testUser1);
});

test("xyk-pallet - MGA tokens are substracted as fee : BurnLiquidity", async () => {
  const from = await getBlockNumber();
  await burnLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(1000)
  );
  const to = await getBlockNumber();
  await checkFee(from, to, testUser1);
});

test("xyk-pallet - MGA tokens are substracted as fee : Transfer", async () => {
  const from = await getBlockNumber();
  await transferAsset(
    testUser1.keyRingPair,
    firstCurrency,
    testUser2.keyRingPair.address,
    new BN(1000)
  );
  const to = await getBlockNumber();
  await checkFee(from, to, testUser1);
});

test("xyk-pallet - MGA tokens are substracted as fee : TransferAll", async () => {
  await sudo.mint(
    firstCurrency,
    testUser2,
    new BN(1000).add(new BN(Math.pow(10, 18).toString()))
  );
  const from = await getBlockNumber();
  await transferAll(
    testUser2.keyRingPair,
    firstCurrency,
    testUser1.keyRingPair.address
  );
  const to = await getBlockNumber();
  await checkFee(from, to, testUser2);
});

test("xyk-pallet - MGA tokens are not substracted as fee : SellAsset", async () => {
  const from = await getBlockNumber();
  await testUser1.sellAssets(firstCurrency, secondCurrency, new BN(50));
  const to = await getBlockNumber();
  await checkFeeSwap(from, to, testUser1);
});

test("xyk-pallet - MGA tokens are / are not substracted as fee : BuyAsset", async () => {
  const from = await getBlockNumber();
  await testUser1.buyAssets(firstCurrency, secondCurrency, new BN(50));
  const to = await getBlockNumber();
  await checkFeeSwap(from, to, testUser1);
});

async function checkFee(from: number, to: number, user: User) {
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    user.keyRingPair.address
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
  await user.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = user.getAsset(MGA_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free!
  );
  expect(new BN(0)).bnLt(diff);
  expect(new BN(0)).bnLt(authorMGAtokens);
  expect(authorMGAtokens).bnEqual(diff!);
}

async function checkFeeSwap(from: number, to: number, user: User) {
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    user.keyRingPair.address
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);

  await user.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = user.getAsset(MGA_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free
  );
  //TODO:swapFees:plz remove me when fees are fixed and keep the else part.
  if (Fees.swapFeesEnabled) {
    expect(new BN(0)).bnLt(diff);
    expect(new BN(0)).bnLt(authorMGAtokens);
    expect(diff).bnEqual(authorMGAtokens);
  } else {
    expect(user.getAsset(firstCurrency)!.amountAfter.free).bnLt(
      user.getAsset(firstCurrency)!.amountBefore.free
    );
    expect(new BN(0)).bnEqual(authorMGAtokens);
    expect(diff).bnEqual(new BN(0));
    expect(user.getAsset(MGA_ASSET_ID)!.amountBefore.free).bnEqual(
      user.getAsset(MGA_ASSET_ID)!.amountAfter.free!
    );
  }
}
