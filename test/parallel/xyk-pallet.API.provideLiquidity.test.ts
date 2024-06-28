/*
 *
 * @group xyk
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO } from "gasp-sdk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  getLiquidityAssetId,
  getRewardsInfo,
  provideLiquidity,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { Xyk } from "../../utils/xyk";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let testUser2: User;
let sudo: User;
let token1: BN;
let token2: BN;
let token3: BN;
let liqIdPromPool: BN;
let liqIdNonPromPool: BN;
let liqIdNonMgaPool: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  [testUser, testUser2] = setupUsers();

  await setupApi();

  [token1, token2, token3] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token3, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(2)),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
        token3,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqIdPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqIdNonPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token2);
  liqIdNonMgaPool = await getLiquidityAssetId(token2, token3);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
  );
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser1));

  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(token1);
  testUser1.addAsset(token2);
  testUser1.addAsset(liqIdPromPool);
  testUser1.addAsset(liqIdNonPromPool);
});

test("Function provideLiquidityWithConversion does not work with non-mga paired token", async () => {
  await provideLiquidity(
    testUser1.keyRingPair,
    liqIdNonMgaPool,
    MGA_ASSET_ID,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("FunctionNotAvailableForThisToken");
  });
});

test("A user without any liq token, can use provideLiquidityWithConversion to mint some tokens.", async () => {
  await provideLiquidity(
    testUser1.keyRingPair,
    liqIdNonPromPool,
    MGA_ASSET_ID,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  expect(testUser1.getAsset(token2)?.amountAfter.free).bnEqual(BN_ZERO);
  expect(testUser1.getAsset(liqIdNonPromPool)?.amountAfter.free).bnGt(BN_ZERO);
});

test("A user without any liq token, can use provideLiquidityWithConversion to mint some tokens on a promoted pool.", async () => {
  await provideLiquidity(
    testUser1.keyRingPair,
    liqIdPromPool,
    MGA_ASSET_ID,
    defaultCurrencyValue,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const testUserRewards = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool,
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  expect(testUser1.getAsset(token1)?.amountAfter.free).bnEqual(BN_ZERO);
  expect(testUser1.getAsset(liqIdPromPool)?.amountAfter.free).bnEqual(BN_ZERO);
  expect(testUser1.getAsset(liqIdPromPool)?.amountAfter.reserved).bnGt(BN_ZERO);
  expect(testUserRewards.activatedAmount).bnGt(BN_ZERO);
});

test("A user who uses provideLiquidityWithConversion and other who do manually a swap + mint, gets the similar ratio of liquidity tokens.", async () => {
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser2));

  testUser2.addAsset(MGA_ASSET_ID);
  testUser2.addAsset(token1);
  testUser2.addAsset(token2);

  const provideLiquidityWithConversion = await provideLiquidity(
    testUser1.keyRingPair,
    liqIdPromPool,
    MGA_ASSET_ID,
    defaultCurrencyValue,
  );
  const eventResponse = getEventResultFromMangataTx(
    provideLiquidityWithConversion,
  );
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const filteredEvent = provideLiquidityWithConversion.filter(
    (event) => event.method === "AssetsSwapped",
  );

  const soldAssetAmount = await filteredEvent[0].event.data[2].toString();

  await testUser2.sellAssets(MGA_ASSET_ID, token1, new BN(soldAssetAmount));

  await testUser2.refreshAmounts(AssetWallet.BEFORE);

  const secondTokenAmount = testUser2.getAsset(token1)!.amountBefore.free;

  await testUser2.mintLiquidity(token1, MGA_ASSET_ID, secondTokenAmount);

  const testUser1Rewards = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool,
  );

  const testUser2Rewards = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPromPool,
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  expect(testUser1.getAsset(token1)?.amountAfter.free).bnEqual(BN_ZERO);
  expect(testUser1.getAsset(liqIdPromPool)?.amountAfter.free).bnEqual(BN_ZERO);
  expect(testUser1.getAsset(liqIdPromPool)?.amountAfter.reserved).bnGt(BN_ZERO);
  expect(testUser1Rewards.activatedAmount).bnGt(BN_ZERO);
  expect(testUser1Rewards.activatedAmount).bnEqual(
    testUser2Rewards.activatedAmount,
  );
});
