/*
 *
 * @group sdk
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { findErrorMetadata } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Xyk } from "../../utils/xyk";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO } from "gasp-sdk";
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let sudo: User;
let token1: BN;
let liqId: BN;
const defaultCurrencyValue = new BN(250000);
const mangata = getMangataInstance();

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));
});

beforeEach(async () => {
  [testUser1] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
  );
  testUser1.addAsset(GASP_ASSET_ID);
  testUser1.addAsset(token1);
  testUser1.addAsset(liqId);
});

test("Check that when we are using SDK batch function and the first call finishes with error next call doesn't finish", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const userLiqTokenBefore = testUser1.getAsset(liqId)?.amountBefore.reserved;

  const extrinsic = await (
    await mangata
  ).batch({
    account: testUser1.keyRingPair,
    calls: [
      Assets.mintToken(token1, testUser1, defaultCurrencyValue),
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
    ],
  });

  const interruption = getEventResultFromMangataTx(extrinsic, [
    "BatchInterrupted",
  ]);

  const err = await findErrorMetadata(
    JSON.parse(JSON.stringify(interruption.data)).error.Module.error,
    JSON.parse(JSON.stringify(interruption.data)).error.Module.index,
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const userLiqTokenAfter = testUser1.getAsset(liqId)?.amountAfter.reserved;

  expect(err.name).toEqual("RequireSudo");
  expect(userLiqTokenBefore).bnEqual(BN_ZERO);
  expect(userLiqTokenAfter).bnEqual(BN_ZERO);
});

test("Check that when we are using SDK batch function and the second call finishes with error first call finishes successful", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const userLiqTokenBefore = testUser1.getAsset(liqId)?.amountBefore.reserved;

  const extrinsic = await (
    await mangata
  ).batch({
    account: testUser1.keyRingPair,
    calls: [
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
      Assets.mintToken(token1, testUser1, defaultCurrencyValue),
    ],
  });

  const interruption = getEventResultFromMangataTx(extrinsic, [
    "BatchInterrupted",
  ]);

  const err = await findErrorMetadata(
    JSON.parse(JSON.stringify(interruption.data)).error.Module.error,
    JSON.parse(JSON.stringify(interruption.data)).error.Module.index,
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const userLiqTokenAfter = testUser1.getAsset(liqId)?.amountAfter.reserved;

  expect(err.name).toEqual("RequireSudo");
  expect(userLiqTokenBefore).bnEqual(BN_ZERO);
  expect(userLiqTokenAfter).bnEqual(defaultCurrencyValue);
});

test("Happy path - batch", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const userMgaTokenBefore =
    testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free;

  const extrinsic = await (
    await mangata
  ).batch({
    account: testUser1.keyRingPair,
    calls: [
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
      Xyk.burnLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
    ],
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const userMgaTokenAfter = testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.free;
  const userLiqTokenAfter = testUser1.getAsset(liqId)?.amountAfter.reserved;

  const eventResponse = getEventResultFromMangataTx(extrinsic, [
    "BatchCompleted",
  ]);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  expect(userMgaTokenBefore).bnGt(userMgaTokenAfter!);
  expect(userLiqTokenAfter).bnEqual(BN_ZERO);
});

test("WHEN call batchAll where one item is failed THEN all entire transactions will rollback and fail", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const userLiqTokenBefore = testUser1.getAsset(liqId)?.amountBefore.reserved;

  const extrinsic = await (
    await mangata
  ).batchAll({
    account: testUser1.keyRingPair,
    calls: [
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
      Assets.mintToken(token1, testUser1, defaultCurrencyValue),
    ],
  });

  const error = getEventResultFromMangataTx(extrinsic, ["ExtrinsicFailed"]);

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const userLiqTokenAfter = testUser1.getAsset(liqId)?.amountAfter.reserved;

  expect(error.data).toEqual("RequireSudo");
  expect(userLiqTokenBefore).bnEqual(BN_ZERO);
  expect(userLiqTokenAfter).bnEqual(BN_ZERO);
});

test("Happy path - batchAll", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const userMgaTokenBefore =
    testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free;

  const extrinsic = await (
    await mangata
  ).batchAll({
    account: testUser1.keyRingPair,
    calls: [
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
      Xyk.burnLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
    ],
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const userMgaTokenAfter = testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.free;
  const userLiqTokenAfter = testUser1.getAsset(liqId)?.amountAfter.reserved;

  const eventResponse = getEventResultFromMangataTx(extrinsic, [
    "BatchCompleted",
  ]);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  expect(userMgaTokenBefore).bnGt(userMgaTokenAfter!);
  expect(userLiqTokenAfter).bnEqual(BN_ZERO);
});

test("WHEN call forceBatch where one item is failed THEN check completed and failed items", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const userLiqTokenBefore = testUser1.getAsset(liqId)?.amountBefore.reserved;

  const extrinsic = await (
    await mangata
  ).forceBatch({
    account: testUser1.keyRingPair,
    calls: [
      Assets.mintToken(token1, testUser1, defaultCurrencyValue),
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
    ],
  });

  const itemCompleted = getEventResultFromMangataTx(extrinsic, [
    "ItemCompleted",
  ]);

  const itemFailed = getEventResultFromMangataTx(extrinsic, ["ItemFailed"]);
  const err = await findErrorMetadata(
    JSON.parse(JSON.stringify(itemFailed.data)).error.Module.error,
    JSON.parse(JSON.stringify(itemFailed.data)).error.Module.index,
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const userLiqTokenAfter = testUser1.getAsset(liqId)?.amountAfter.reserved;

  expect(itemCompleted.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  expect(err.name).toEqual("RequireSudo");
  expect(userLiqTokenBefore).bnEqual(BN_ZERO);
  expect(userLiqTokenAfter).bnEqual(defaultCurrencyValue);
});

test("Happy path - forceBatch", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const userMgaTokenBefore =
    testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free;

  const extrinsic = await (
    await mangata
  ).forceBatch({
    account: testUser1.keyRingPair,
    calls: [
      Xyk.mintLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
      Xyk.burnLiquidity(GASP_ASSET_ID, token1, defaultCurrencyValue),
    ],
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const userMgaTokenAfter = testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.free;
  const userLiqTokenAfter = testUser1.getAsset(liqId)?.amountAfter.reserved;

  const eventResponse = getEventResultFromMangataTx(extrinsic, [
    "BatchCompleted",
  ]);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  expect(userMgaTokenBefore).bnGt(userMgaTokenAfter!);
  expect(userLiqTokenAfter).bnEqual(BN_ZERO);
});
