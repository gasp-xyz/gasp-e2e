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
import { getUserBalanceOfToken } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  activateLiquidity,
  getBalanceOfPool,
  getLiquidityAssetId,
  getRewardsInfo,
} from "../../utils/tx";
import {
  BN_BILLION,
  BN_HUNDRED,
  BN_ONE,
  BN_ZERO,
  MangataInstance,
  MangataSubmittableExtrinsic,
} from "@mangata-finance/sdk";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { signSendFinalized } from "../../utils/sign";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;
let token1: BN;
let token2: BN;
let liqId: BN;
let liqId2: BN;
let mangata: MangataInstance;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  const users = setupUsers();
  testUser = users[5];

  await setupApi();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  mangata = await getMangataInstance();

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(10)),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);
  liqId2 = await getLiquidityAssetId(GASP_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Assets.promotePool(liqId2.toNumber(), 20),
  );

  testUser.addAsset(liqId);
  testUser.addAsset(liqId2);
  testUser.addAsset(GASP_ASSET_ID);
  testUser.addAsset(token1);
});

test("activate some Liquidity using SDK THEN claim rewards THEN deactivate Liquidity", async () => {
  await testUser.refreshAmounts(AssetWallet.BEFORE);

  const tx1 = await mangata.submitableExtrinsic.activateLiquidity(
    {
      account: testUser.keyRingPair.address,
      amount: BN_BILLION,
      liquidityTokenId: liqId.toString(),
    },
    "AvailableBalance",
  );

  await signSubmittableExtrinsic(tx1, testUser);

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const reservedTokens = testUser.getAsset(liqId)?.amountAfter.reserved!;

  expect(reservedTokens).bnEqual(BN_BILLION);

  const tx2 = await mangata.submitableExtrinsic.deactivateLiquidity({
    account: testUser.keyRingPair.address,
    amount: BN_BILLION,
    liquidityTokenId: liqId.toString(),
  });

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await signSubmittableExtrinsic(tx2, testUser);

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const amountDifference = testUser
    .getAsset(liqId)!
    .amountBefore.reserved.sub(testUser.getAsset(liqId)!.amountAfter.reserved);

  expect(amountDifference).bnEqual(BN_BILLION);
});

test("check claimRewards", async () => {
  await activateLiquidity(testUser.keyRingPair, liqId2, BN_BILLION);

  await waitForRewards(testUser, liqId2);

  const tx2 = await mangata.submitableExtrinsic.claimRewards({
    account: testUser.keyRingPair.address,
    liquidityTokenId: liqId2.toString(),
  });

  const userTokenBeforeClaiming = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId2,
  );

  await signSubmittableExtrinsic(tx2, testUser);

  const userTokenAfterClaiming = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId2,
  );

  expect(userTokenBeforeClaiming.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(userTokenAfterClaiming.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});

test("check mintLiquidity", async () => {
  const tx = await mangata.submitableExtrinsic.mintLiquidity({
    account: testUser.keyRingPair.address,
    expectedSecondTokenAmount: BN_BILLION,
    firstTokenAmount: BN_HUNDRED,
    firstTokenId: GASP_ASSET_ID.toString(),
    secondTokenId: token1.toString(),
  });

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await signSubmittableExtrinsic(tx, testUser);

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const amountDifference = testUser
    .getAsset(liqId)
    ?.amountAfter.reserved!.sub(
      testUser.getAsset(liqId)?.amountBefore.reserved!,
    );

  expect(amountDifference).bnEqual(BN_HUNDRED);
});

test("check burnLiquidity", async () => {
  const tx = await mangata.submitableExtrinsic.burnLiquidity({
    account: testUser.keyRingPair.address,
    amount: BN_HUNDRED,
    firstTokenId: GASP_ASSET_ID.toString(),
    secondTokenId: token1.toString(),
  });

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await signSubmittableExtrinsic(tx, testUser);

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const amountDifference = testUser
    .getAsset(liqId)
    ?.amountBefore.free!.sub(testUser.getAsset(liqId)?.amountAfter.free!);

  expect(amountDifference).bnEqual(BN_HUNDRED);
});

test("check createPool", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
  );

  const tx = await mangata.submitableExtrinsic.createPool({
    account: testUser.keyRingPair.address,
    firstTokenAmount: Assets.DEFAULT_AMOUNT.divn(2),
    firstTokenId: GASP_ASSET_ID.toString(),
    secondTokenAmount: Assets.DEFAULT_AMOUNT.divn(2),
    secondTokenId: token2.toString(),
  });

  await signSubmittableExtrinsic(tx, testUser);

  const balancePool = await getBalanceOfPool(GASP_ASSET_ID, token2);
  const liqId2 = await getLiquidityAssetId(GASP_ASSET_ID, token2);

  expect(liqId2).bnGt(BN_ZERO);
  expect(balancePool[0]).bnEqual(Assets.DEFAULT_AMOUNT.divn(2));
  expect(balancePool[1]).bnEqual(Assets.DEFAULT_AMOUNT.divn(2));
});

test("check multiswapBuyAsset", async () => {
  const tx = await mangata.submitableExtrinsic.multiswapBuyAsset({
    account: testUser.keyRingPair.address,
    tokenIds: [GASP_ASSET_ID.toString(), token1.toString()],
    amount: BN_HUNDRED,
    maxAmountIn: BN_BILLION,
  });

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await signSubmittableExtrinsic(tx, testUser);

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const amountDifference = testUser
    .getAsset(token1)
    ?.amountAfter.free!.sub(testUser.getAsset(token1)?.amountBefore.free!);

  expect(amountDifference).bnEqual(BN_HUNDRED);
});

test("check multiswapSellAsset", async () => {
  const tx = await mangata.submitableExtrinsic.multiswapSellAsset({
    account: testUser.keyRingPair.address,
    tokenIds: [GASP_ASSET_ID.toString(), token1.toString()],
    amount: BN_HUNDRED,
    minAmountOut: BN_ONE,
  });

  await testUser.refreshAmounts(AssetWallet.BEFORE);
  await signSubmittableExtrinsic(tx, testUser);

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const amountDifference = testUser
    .getAsset(token1)
    ?.amountAfter.free!.sub(testUser.getAsset(token1)?.amountBefore.free!);

  expect(amountDifference).bnGt(BN_ZERO);
  expect(amountDifference).bnLte(BN_HUNDRED);
});

test("check transferTokens", async () => {
  const [testUser1] = setupUsers();

  const tx = await mangata.submitableExtrinsic.transferTokens({
    account: testUser.keyRingPair.address,
    address: testUser1.keyRingPair.address,
    amount: BN_BILLION,
    tokenId: GASP_ASSET_ID.toString(),
  });

  await signSubmittableExtrinsic(tx, testUser);

  const balance = await getUserBalanceOfToken(GASP_ASSET_ID, testUser1);

  expect(balance.free).bnEqual(BN_BILLION);
});

test("check transferAllTokens", async () => {
  const [testUser1] = setupUsers();

  const tx = await mangata.submitableExtrinsic.transferAllTokens({
    account: testUser.keyRingPair.address,
    address: testUser1.keyRingPair.address,
    tokenId: token1.toString(),
  });

  await signSubmittableExtrinsic(tx, testUser);

  const firstUserBalance = await getUserBalanceOfToken(token1, testUser);
  const secondUserBalance = await getUserBalanceOfToken(token1, testUser1);

  expect(firstUserBalance.free).bnEqual(BN_ZERO);
  expect(secondUserBalance.free).bnGt(BN_ZERO);
});

async function signSubmittableExtrinsic(
  tx: MangataSubmittableExtrinsic,
  user: User,
) {
  const result = await signSendFinalized(tx, user);
  const eventResponse = getEventResultFromMangataTx(result);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  return result;
}
