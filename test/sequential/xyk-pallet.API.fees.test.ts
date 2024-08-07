/* eslint-disable jest/no-conditional-expect */
// todo remove test once v2 is passing on CI for some time
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  burnLiquidity,
  createPool,
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
import { GASP_ASSET_ID } from "../../utils/Constants";
import { waitNewBlock } from "../../utils/eventListeners";
import { Fees } from "../../utils/Fees";

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
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

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
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );
  //add zero MGA tokens.
  await testUser1.addGASPTokens(sudo);
  testUser1.addAsset(GASP_ASSET_ID);
  await testUser2.addGASPTokens(sudo);
  testUser2.addAsset(GASP_ASSET_ID);

  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    new BN(1000),
    secondCurrency,
    new BN(1000),
  );
});

beforeEach(async () => {
  await waitIfSessionWillChangeInNblocks(7);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-pallet - MGA tokens are substracted as fee : CreatePool", async () => {
  const [thirdCurrency, fourthCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );
  await waitNewBlock();
  const from = await getBlockNumber();
  await createPool(
    testUser1.keyRingPair,
    thirdCurrency,
    new BN(1000),
    fourthCurrency,
    new BN(100),
  );
  const to = await getBlockNumber();
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    testUser1.keyRingPair.address,
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(GASP_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free!,
  );
  expect(new BN(0)).bnLt(diff);
  expect(new BN(0)).bnLt(authorMGAtokens);
  expect(authorMGAtokens).bnEqual(diff);
});
test("xyk-pallet - MGA tokens are substracted as fee : MintLiquidity", async () => {
  const from = await getBlockNumber();
  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(1000),
  );
  const to = await getBlockNumber();
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    testUser1.keyRingPair.address,
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(GASP_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free!,
  );
  expect(new BN(0)).bnLt(diff);
  expect(new BN(0)).bnLt(authorMGAtokens);
  expect(authorMGAtokens).bnEqual(diff!);
});
test("xyk-pallet - MGA tokens are substracted as fee : BurnLiquidity", async () => {
  const from = await getBlockNumber();
  await burnLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(1000),
  );
  const to = await getBlockNumber();
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    testUser1.keyRingPair.address,
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(GASP_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free!,
  );
  expect(new BN(0)).bnLt(diff);
  expect(new BN(0)).bnLt(authorMGAtokens);
  expect(authorMGAtokens).bnEqual(diff!);
});
test("xyk-pallet - MGA tokens are substracted as fee : Transfer", async () => {
  const from = await getBlockNumber();
  await transferAsset(
    testUser1.keyRingPair,
    firstCurrency,
    testUser2.keyRingPair.address,
    new BN(1000),
  );
  const to = await getBlockNumber();
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    testUser1.keyRingPair.address,
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(GASP_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free!,
  );
  expect(new BN(0)).bnLt(diff);
  expect(new BN(0)).bnLt(authorMGAtokens);
  expect(authorMGAtokens).bnEqual(diff!);
});
test("xyk-pallet - MGA tokens are substracted as fee : TransferAll", async () => {
  await sudo.mint(
    firstCurrency,
    testUser2,
    new BN(1000).add(new BN(Math.pow(10, 18).toString())),
  );
  const from = await getBlockNumber();
  await transferAll(
    testUser2.keyRingPair,
    firstCurrency,
    testUser1.keyRingPair.address,
  );
  const to = await getBlockNumber();
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    testUser2.keyRingPair.address,
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);

  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser2.getAsset(GASP_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free!,
  );
  expect(new BN(0)).bnLt(diff);
  expect(new BN(0)).bnLt(authorMGAtokens);
  expect(authorMGAtokens).bnEqual(diff!);
});
test("xyk-pallet - MGA tokens are not substracted as fee : SellAsset", async () => {
  const from = await getBlockNumber();
  await testUser1.sellAssets(firstCurrency, secondCurrency, new BN(50));
  const to = await getBlockNumber();
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    testUser1.keyRingPair.address,
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(GASP_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free,
  );
  //TODO:swapFees:plz remove me when fees are fixed and keep the else part.
  if (Fees.swapFeesEnabled) {
    expect(new BN(0)).bnLt(diff);
    expect(new BN(0)).bnLt(authorMGAtokens);
    expect(diff).bnEqual(authorMGAtokens);
  } else {
    expect(testUser1.getAsset(firstCurrency)!.amountAfter.free).bnLt(
      testUser1.getAsset(firstCurrency)!.amountBefore.free,
    );
    expect(new BN(0)).bnEqual(authorMGAtokens);
    expect(diff).bnEqual(new BN(0));
    expect(testUser1.getAsset(GASP_ASSET_ID)!.amountBefore.free).bnEqual(
      testUser1.getAsset(GASP_ASSET_ID)!.amountAfter.free!,
    );
  }
});
test("xyk-pallet - MGA tokens are / are not substracted as fee : BuyAsset", async () => {
  const from = await getBlockNumber();
  await testUser1.buyAssets(firstCurrency, secondCurrency, new BN(50));
  const to = await getBlockNumber();
  const blockNumber = await findBlockWithExtrinsicSigned(
    [from, to],
    testUser1.keyRingPair.address,
  );
  const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const mgaUserToken = testUser1.getAsset(GASP_ASSET_ID)!;
  const diff = mgaUserToken.amountBefore.free.sub(
    mgaUserToken.amountAfter.free!,
  );

  //TODO:swapFees:plz remove me when fees are fixed and keep the else part.
  if (Fees.swapFeesEnabled) {
    expect(new BN(0)).bnLt(diff);
    expect(new BN(0)).bnLt(authorMGAtokens);
    expect(diff).bnEqual(authorMGAtokens);
  } else {
    expect(testUser1.getAsset(firstCurrency)!.amountAfter.free).bnLt(
      testUser1.getAsset(firstCurrency)!.amountBefore.free,
    );
    expect(new BN(0)).bnEqual(authorMGAtokens);
    expect(diff).bnEqual(new BN(0));
    expect(testUser1.getAsset(GASP_ASSET_ID)!.amountBefore.free).bnEqual(
      testUser1.getAsset(GASP_ASSET_ID)!.amountAfter.free!,
    );
  }
});
