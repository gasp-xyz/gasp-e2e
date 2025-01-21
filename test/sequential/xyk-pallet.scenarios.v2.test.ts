import {
  calculateFees,
  calculateLiqAssetAmount,
  getEnvironmentRequiredVars,
  xykErrors,
} from "../../utils/utils";
import {
  calcuate_burn_liquidity_price_local,
  calcuate_mint_liquidity_price_local,
  calculate_buy_price_local,
  calculate_buy_price_rpc,
  calculate_sell_price_local,
  calculate_sell_price_rpc,
  getAssetSupply,
  getBalanceOfPool,
  getLiquidityAssetId,
} from "../../utils/tx";
import { BN_ZERO } from "gasp-sdk";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { AssetWallet, User } from "../../utils/User";
import { BN } from "@polkadot/util";
import { keyring, setupApi, setupUsers } from "../../utils/setup";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { testLog } from "../../utils/Logger";
import { signSendFinalized } from "../../utils/sign";
import { SudoDB } from "../../utils/SudoDB";
import { Market } from "../../utils/market";

function assetsAfterFree(user: User): BN[] {
  return user.assets.map((asset) => asset.amountAfter.free);
}

function assetsBeforeFree(user: User): BN[] {
  return user.assets.map((asset) => asset.amountBefore.free);
}

/**
 * @group xyk
 * @group market
 * @group sequential
 * @group critical
 */
describe("xyk-pallet: Happy case scenario", () => {
  let xykPalletUser: User;
  let assetId1: BN;
  let assetId2: BN;
  let liquidityAssetId: BN;
  let poolBalanceBefore: BN[];
  let totalLiquidityAssetsBefore: BN;
  let user1: User;
  let user2: User;

  beforeAll(async () => {
    await setupApi();
    [user1, user2] = setupUsers();

    const { xykPalletAddress } = getEnvironmentRequiredVars();
    xykPalletUser = new User(keyring);
    xykPalletUser.addFromAddress(keyring, xykPalletAddress);

    assetId1 = await SudoDB.getInstance().getTokenId();
    assetId2 = await SudoDB.getInstance().getTokenId();
    //liquidityAssetId = assetId2.add(BN_ONE);
    user1.addAsset(assetId1, Assets.DEFAULT_AMOUNT);
    user1.addAsset(assetId2, Assets.DEFAULT_AMOUNT);
    //user1.addAsset(liquidityAssetId);
    user2.addAsset(assetId1);
    user2.addAsset(assetId2);
    //user2.addAsset(liquidityAssetId);
    xykPalletUser.addAsset(assetId1);
    xykPalletUser.addAsset(assetId2);

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user1),
      Assets.mintNative(user2),
      Assets.mintToken(assetId1, user1),
      Assets.mintToken(assetId2, user1),
    );

    // remove native token, convenience for comparisons
    user1.assets.pop();
    user2.assets.pop();
  });

  it("xyk-pallet: Happy case scenario", async () => {
    testLog.getLog().info("running section: createPoolTest");
    await refreshAmounts();
    await createPoolTest();

    testLog.getLog().info("running section: mintLiquidityTest");
    await refreshAmounts();
    await mintLiquidityTest();

    testLog.getLog().info("running section: transferTest");
    await refreshAmounts();
    await transferTest();

    testLog.getLog().info("running section: sellAsset1Test");
    await refreshAmounts();
    await sellAsset1Test();

    testLog.getLog().info("running section: sellAsset2Test");
    await refreshAmounts();
    await sellAsset2Test();

    testLog.getLog().info("running section: buyAsset2Test");
    await refreshAmounts();
    await buyAsset2Test();

    testLog.getLog().info("running section: buyAsset1Test");
    await refreshAmounts();
    await buyAsset1Test();

    testLog.getLog().info("running section: burnLiquidityTest");
    await refreshAmounts();
    await burnLiquidityTest();
  });

  async function refreshAmounts() {
    await user1.refreshAmounts(AssetWallet.BEFORE);
    await user2.refreshAmounts(AssetWallet.BEFORE);
    await xykPalletUser.refreshAmounts(AssetWallet.BEFORE);
    poolBalanceBefore = await getBalanceOfPool(assetId1, assetId2);
    if (liquidityAssetId !== undefined) {
      totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
    } else {
      totalLiquidityAssetsBefore = BN_ZERO;
    }
  }

  async function createPoolTest() {
    const assetAmount1 = new BN(50000);
    const assetAmount2 = new BN(50000);
    await signSendFinalized(
      Market.createPool(assetId1, assetAmount1, assetId2, assetAmount2),
      user1,
    );
    liquidityAssetId = await getLiquidityAssetId(assetId1, assetId2);
    user2.addAsset(liquidityAssetId);
    user1.addAsset(liquidityAssetId);
    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const liquidityAssetsMinted = calculateLiqAssetAmount(
      assetAmount1,
      assetAmount2,
    );

    expect([
      user1.getAsset(assetId1)!.amountBefore.free.sub(assetAmount1),
      user1.getAsset(assetId2)!.amountBefore.free.sub(assetAmount2),
      user1
        .getAsset(liquidityAssetId)!
        .amountBefore.free.add(liquidityAssetsMinted),
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect(assetsBeforeFree(user2)).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.add(assetAmount1),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.add(assetAmount2),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].add(assetAmount1),
      poolBalanceBefore[1].add(assetAmount2),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore.add(liquidityAssetsMinted)).bnEqual(
      totalLiquidityAssets,
    );
  }

  async function mintLiquidityTest() {
    const assetAmount1 = new BN(30000);
    const [assetAmount2, liquidityAssetsMinted] =
      await calcuate_mint_liquidity_price_local(
        assetId1,
        assetId2,
        assetAmount1,
      );

    await signSendFinalized(
      Market.mintLiquidity(
        liquidityAssetId,
        assetId1,
        assetAmount1,
        assetAmount2,
      ),
      user1,
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user1.getAsset(assetId1)!.amountBefore.free.sub(assetAmount1),
      user1.getAsset(assetId2)!.amountBefore.free.sub(assetAmount2),
      user1
        .getAsset(liquidityAssetId)!
        .amountBefore.free.add(liquidityAssetsMinted),
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect(assetsBeforeFree(user2)).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.add(assetAmount1),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.add(assetAmount2),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].add(assetAmount1),
      poolBalanceBefore[1].add(assetAmount2),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore.add(liquidityAssetsMinted)).bnEqual(
      totalLiquidityAssets,
    );
  }

  async function transferTest() {
    const amount = new BN(100000);
    await signSendFinalized(Assets.transfer(user2, assetId1, amount), user1);

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user1.getAsset(assetId1)!.amountBefore.free.sub(amount),
      user1.getAsset(assetId2)!.amountBefore.free,
      user1.getAsset(liquidityAssetId)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free.add(amount),
      user2.getAsset(assetId2)!.amountBefore.free,
      user2.getAsset(liquidityAssetId)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user2));

    expect(assetsBeforeFree(xykPalletUser)).collectionBnEqual(
      assetsAfterFree(xykPalletUser),
    );

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect(poolBalanceBefore).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore).bnEqual(totalLiquidityAssets);
  }

  async function sellAsset1Test() {
    const amount = new BN(30000);
    const sellPriceLocal = calculate_sell_price_local(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount,
    );
    const sellPriceRpc = await calculate_sell_price_rpc(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount,
    );

    expect(sellPriceLocal).bnEqual(sellPriceRpc);

    await signSendFinalized(
      Market.sellAsset(liquidityAssetId, assetId1, assetId2, amount),
      user2,
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(amount);
    const fee = treasury.add(treasuryBurn);

    expect(assetsBeforeFree(user1)).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free.sub(amount),
      user2.getAsset(assetId2)!.amountBefore.free.add(sellPriceLocal),
      user2.getAsset(liquidityAssetId)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.add(amount).sub(fee),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.sub(sellPriceLocal),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].add(amount).sub(fee),
      poolBalanceBefore[1].sub(sellPriceLocal),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore).bnEqual(totalLiquidityAssets);
  }

  async function sellAsset2Test() {
    const amount = new BN(20000);
    const sellPriceLocal = calculate_sell_price_local(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount,
    );
    const sellPriceRpc = await calculate_sell_price_rpc(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount,
    );

    expect(sellPriceLocal).bnEqual(sellPriceRpc);

    await signSendFinalized(
      Market.sellAsset(liquidityAssetId, assetId2, assetId1, amount),
      user2,
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(amount);
    const fee = treasury.add(treasuryBurn);

    expect(assetsBeforeFree(user1)).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free.add(sellPriceLocal),
      user2.getAsset(assetId2)!.amountBefore.free.sub(amount),
      user2.getAsset(liquidityAssetId)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.sub(sellPriceLocal),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.add(amount).sub(fee),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].sub(sellPriceLocal),
      poolBalanceBefore[1].add(amount).sub(fee),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore).bnEqual(totalLiquidityAssets);
  }

  async function buyAsset2Test() {
    const amount = new BN(10000);
    const buyPriceLocal = calculate_buy_price_local(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount,
    );
    const buyPriceRpc = await calculate_buy_price_rpc(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount,
    );

    expect(buyPriceLocal).bnEqual(buyPriceRpc);

    await signSendFinalized(
      Market.buyAsset(liquidityAssetId, assetId1, assetId2, amount),
      user2,
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(buyPriceLocal);
    const fee = treasury.add(treasuryBurn);

    expect(assetsBeforeFree(user1)).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free.sub(buyPriceLocal),
      user2.getAsset(assetId2)!.amountBefore.free.add(amount),
      user2.getAsset(liquidityAssetId)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser
        .getAsset(assetId1)!
        .amountBefore.free.add(buyPriceLocal)
        .sub(fee),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.sub(amount),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].add(buyPriceLocal).sub(fee),
      poolBalanceBefore[1].sub(amount),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore).bnEqual(totalLiquidityAssets);
  }

  async function buyAsset1Test() {
    const amount = new BN(10000);
    const buyPriceLocal = calculate_buy_price_local(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount,
    );
    const buyPriceRpc = await calculate_buy_price_rpc(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount,
    );

    expect(buyPriceLocal).bnEqual(buyPriceRpc);

    await signSendFinalized(
      Market.buyAsset(liquidityAssetId, assetId2, assetId1, amount),
      user2,
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(buyPriceLocal);
    const fee = treasury.add(treasuryBurn);

    expect(assetsBeforeFree(user1)).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free.add(amount),
      user2.getAsset(assetId2)!.amountBefore.free.sub(buyPriceLocal),
      user2.getAsset(liquidityAssetId)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.sub(amount),
      xykPalletUser
        .getAsset(assetId2)!
        .amountBefore.free.add(buyPriceLocal)
        .sub(fee),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].sub(amount),
      poolBalanceBefore[1].add(buyPriceLocal).sub(fee),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore).bnEqual(totalLiquidityAssets);
  }

  async function burnLiquidityTest() {
    const amount = new BN(20000);
    const [assetAmount1, assetAmount2] =
      await calcuate_burn_liquidity_price_local(assetId1, assetId2, amount);

    await signSendFinalized(
      Market.burnLiquidity(liquidityAssetId, amount),
      user1,
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user1.getAsset(assetId1)!.amountBefore.free.add(assetAmount1),
      user1.getAsset(assetId2)!.amountBefore.free.add(assetAmount2),
      user1.getAsset(liquidityAssetId)!.amountBefore.free.sub(amount),
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect(assetsBeforeFree(user2)).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.sub(assetAmount1),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.sub(assetAmount2),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].sub(assetAmount1),
      poolBalanceBefore[1].sub(assetAmount2),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore.sub(amount)).bnEqual(
      totalLiquidityAssets,
    );
  }
});

describe("xyk-pallet: Liquidity sufficiency scenario", () => {
  let xykPalletUser: User;
  let assetId1: BN;
  let assetId2: BN;
  let liquidityAssetId: BN;
  let poolBalanceBefore: BN[];
  let totalLiquidityAssetsBefore: BN;
  let user1: User;
  let user2: User;

  async function expectNoChange() {
    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect(assetsBeforeFree(user1)).collectionBnEqual(assetsAfterFree(user1));
    expect(assetsBeforeFree(user2)).collectionBnEqual(assetsAfterFree(user2));

    expect(assetsBeforeFree(xykPalletUser)).collectionBnEqual(
      assetsAfterFree(xykPalletUser),
    );

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect(poolBalanceBefore).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore).bnEqual(totalLiquidityAssets);
  }

  beforeAll(async () => {
    await setupApi();
    [user1, user2] = setupUsers();

    const { xykPalletAddress } = getEnvironmentRequiredVars();
    xykPalletUser = new User(keyring);
    xykPalletUser.addFromAddress(keyring, xykPalletAddress);

    assetId1 = await SudoDB.getInstance().getTokenId();
    assetId2 = await SudoDB.getInstance().getTokenId();
    //liquidityAssetId = assetId2.add(BN_ONE);
    user1.addAsset(assetId1, Assets.DEFAULT_AMOUNT);
    user1.addAsset(assetId2, Assets.DEFAULT_AMOUNT);
    //user1.addAsset(liquidityAssetId);
    user2.addAsset(assetId1);
    user2.addAsset(assetId2);
    //user2.addAsset(liquidityAssetId);
    xykPalletUser.addAsset(assetId1);
    xykPalletUser.addAsset(assetId2);

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user1),
      Assets.mintNative(user2),
      Assets.mintToken(assetId1, user1),
      Assets.mintToken(assetId2, user1),
    );

    // remove native token, convenience for comparisons
    user1.assets.pop();
    user2.assets.pop();
  });

  it("xyk-pallet: Liquidity sufficiency scenario", async () => {
    testLog.getLog().info("running section: transferAasset1Test");
    await refreshAmounts();
    await transferAasset1Test();

    testLog.getLog().info("running section: transferAsset2Test");
    await refreshAmounts();
    await transferAsset2Test();

    testLog.getLog().info("running section: createPoolTest");
    await refreshAmounts();
    await createPoolTest();

    testLog.getLog().info("running section: mintLiquidityTest");
    await refreshAmounts();
    await mintLiquidityTest();

    testLog.getLog().info("running section: mintLiquidityUser2Test");
    await refreshAmounts();
    await mintLiquidityUser2Test();

    testLog.getLog().info("running section: burnMoreLiquidityThanTheyHaveTest");
    await refreshAmounts();
    await burnMoreLiquidityThanTheyHaveTest();

    testLog
      .getLog()
      .info("running section: burnMoreLiquidityThanTheyHaveUser2Test");
    await refreshAmounts();
    await burnMoreLiquidityThanTheyHaveUser2Test();

    testLog.getLog().info("running section: burnAllLiquidityTest");
    await refreshAmounts();
    await burnAllLiquidityTest();

    testLog
      .getLog()
      .info(
        "running section: burnMoreLiquidityThanTheyHaveUser2Has100OfThePoolTest",
      );
    await refreshAmounts();
    await burnMoreLiquidityThanTheyHaveUser2Has100OfThePoolTest();

    testLog.getLog().info("running section: burnAllLiquidityUser2Test");
    await refreshAmounts();
    await burnAllLiquidityUser2Test();

    testLog.getLog().info("running section: burnLiquidityFromEmptyPoolTest");
    await refreshAmounts();
    await burnLiquidityFromEmptyPoolTest();

    testLog.getLog().info("running section: sellAsset1FromEmptyPoolTest");
    await refreshAmounts();
    await sellAsset1FromEmptyPoolTest();

    testLog.getLog().info("running section: sellAsset2FromEmptyPoolTest");
    await refreshAmounts();
    await sellAsset2FromEmptyPoolTest();

    testLog.getLog().info("running section: buyAsset1FromEmptyPoolTest");
    await refreshAmounts();
    await buyAsset1FromEmptyPoolTest();

    testLog.getLog().info("running section: buyAsset2FromEmptyPoolTest");
    await refreshAmounts();
    await buyAsset2FromEmptyPoolTest();
  });

  async function refreshAmounts() {
    await user1.refreshAmounts(AssetWallet.BEFORE);
    await user2.refreshAmounts(AssetWallet.BEFORE);
    await xykPalletUser.refreshAmounts(AssetWallet.BEFORE);
    poolBalanceBefore = await getBalanceOfPool(assetId1, assetId2);
    if (liquidityAssetId !== undefined) {
      totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
    } else {
      totalLiquidityAssetsBefore = BN_ZERO;
    }
  }

  async function transferAasset1Test() {
    const amount = new BN(100000);
    await signSendFinalized(Assets.transfer(user2, assetId1, amount), user1);

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user1.getAsset(assetId1)!.amountBefore.free.sub(amount),
      user1.getAsset(assetId2)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free.add(amount),
      user2.getAsset(assetId2)!.amountBefore.free,
    ]).collectionBnEqual(assetsAfterFree(user2));
  }

  async function transferAsset2Test() {
    const amount = new BN(100000);
    await signSendFinalized(Assets.transfer(user2, assetId2, amount), user1);

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user1.getAsset(assetId1)!.amountBefore.free,
      user1.getAsset(assetId2)!.amountBefore.free.sub(amount),
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free,
      user2.getAsset(assetId2)!.amountBefore.free.add(amount),
    ]).collectionBnEqual(assetsAfterFree(user2));
  }

  async function createPoolTest() {
    const assetAmount1 = new BN(60000);
    const assetAmount2 = new BN(60000);

    await signSendFinalized(
      Market.createPool(assetId1, assetAmount1, assetId2, assetAmount2),
      user1,
    );
    liquidityAssetId = await getLiquidityAssetId(assetId1, assetId2);
    user2.addAsset(liquidityAssetId);
    user1.addAsset(liquidityAssetId);
    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const liquidityAssetsMinted = calculateLiqAssetAmount(
      assetAmount1,
      assetAmount2,
    );

    expect([
      user1.getAsset(assetId1)!.amountBefore.free.sub(assetAmount1),
      user1.getAsset(assetId2)!.amountBefore.free.sub(assetAmount2),
      user1
        .getAsset(liquidityAssetId)!
        .amountBefore.free.add(liquidityAssetsMinted),
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect(assetsBeforeFree(user2)).collectionBnEqual(assetsAfterFree(user2));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.add(assetAmount1),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.add(assetAmount2),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].add(assetAmount1),
      poolBalanceBefore[1].add(assetAmount2),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore.add(liquidityAssetsMinted)).bnEqual(
      totalLiquidityAssets,
    );
  }

  async function mintLiquidityTest() {
    await mint(user1, user2);
  }

  async function mintLiquidityUser2Test() {
    await mint(user2, user1);
  }

  async function burnMoreLiquidityThanTheyHaveTest() {
    await burnLiquidityFail(user1);
  }

  async function burnMoreLiquidityThanTheyHaveUser2Test() {
    await burnLiquidityFail(user2);
  }

  async function burnAllLiquidityTest() {
    await burnAll(user1, user2);
  }

  async function burnMoreLiquidityThanTheyHaveUser2Has100OfThePoolTest() {
    await burnLiquidityFail(user2);
  }

  async function burnAllLiquidityUser2Test() {
    await burnAll(user2, user1);
  }

  async function burnLiquidityFromEmptyPoolTest() {
    const amount = new BN(10000);

    await signSendFinalized(
      Market.burnLiquidity(liquidityAssetId, amount),
      user2,
    ).catch(checkError(xykErrors.NotEnoughAssets));
    testLog.getLog().info("ExpectNoChange On:burnLiquidityFromEmptyPoolTest");
    await expectNoChange();
  }

  async function sellAsset1FromEmptyPoolTest() {
    await sellAssetFail(assetId1, assetId2, xykErrors.PoolIsEmpty);
  }

  async function sellAsset2FromEmptyPoolTest() {
    await sellAssetFail(assetId2, assetId1, xykErrors.PoolIsEmpty);
  }

  async function buyAsset1FromEmptyPoolTest() {
    await buyAssetFail(assetId1, assetId2, xykErrors.ExcesiveInputAmount);
  }

  async function buyAsset2FromEmptyPoolTest() {
    await buyAssetFail(assetId2, assetId1, xykErrors.ExcesiveInputAmount);
  }

  async function mint(user: User, other: User) {
    const assetAmount1 = new BN(20000);
    const [assetAmount2, liquidityAssetsMinted] =
      await calcuate_mint_liquidity_price_local(
        assetId1,
        assetId2,
        assetAmount1,
      );

    await signSendFinalized(
      Market.mintLiquidity(
        liquidityAssetId,
        assetId1,
        assetAmount1,
        assetAmount2,
      ),
      user,
    );

    await user.refreshAmounts(AssetWallet.AFTER);
    await other.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user.getAsset(assetId1)!.amountBefore.free.sub(assetAmount1),
      user.getAsset(assetId2)!.amountBefore.free.sub(assetAmount2),
      user
        .getAsset(liquidityAssetId)!
        .amountBefore.free.add(liquidityAssetsMinted),
    ]).collectionBnEqual(assetsAfterFree(user));

    expect(assetsBeforeFree(other)).collectionBnEqual(assetsAfterFree(other));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.add(assetAmount1),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.add(assetAmount2),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].add(assetAmount1),
      poolBalanceBefore[1].add(assetAmount2),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore.add(liquidityAssetsMinted)).bnEqual(
      totalLiquidityAssets,
    );
  }

  async function burnAll(user: User, other: User) {
    const amount = user.getAsset(liquidityAssetId)!.amountBefore.free;
    const [assetAmount1, assetAmount2] =
      await calcuate_burn_liquidity_price_local(assetId1, assetId2, amount);

    await signSendFinalized(
      Market.burnLiquidity(liquidityAssetId, amount),
      user,
    );

    await user.refreshAmounts(AssetWallet.AFTER);
    await other.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user.getAsset(assetId1)!.amountBefore.free.add(assetAmount1),
      user.getAsset(assetId2)!.amountBefore.free.add(assetAmount2),
      user.getAsset(liquidityAssetId)!.amountBefore.free.sub(amount),
    ]).collectionBnEqual(assetsAfterFree(user));

    expect(assetsBeforeFree(other)).collectionBnEqual(assetsAfterFree(other));

    expect([
      xykPalletUser.getAsset(assetId1)!.amountBefore.free.sub(assetAmount1),
      xykPalletUser.getAsset(assetId2)!.amountBefore.free.sub(assetAmount2),
    ]).collectionBnEqual(assetsAfterFree(xykPalletUser));

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect([
      poolBalanceBefore[0].sub(assetAmount1),
      poolBalanceBefore[1].sub(assetAmount2),
    ]).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore.sub(amount)).bnEqual(
      totalLiquidityAssets,
    );
  }

  async function burnLiquidityFail(user: User) {
    const assetsBurned = user.getAsset(liquidityAssetId)!.amountBefore.free;
    const excess = assetsBurned.mul(new BN(105)).div(new BN(100));

    await signSendFinalized(
      Market.burnLiquidity(liquidityAssetId, excess),
      user,
    ).catch(checkError(xykErrors.NotEnoughAssets));
    testLog.getLog().info("ExpectNoChange On:burnLiquidityFail");
    await expectNoChange();
  }

  async function sellAssetFail(
    sell: BN,
    buy: BN,
    error = xykErrors.NotEnoughAssets,
  ) {
    const amount = new BN(20000);
    const liq = await getLiquidityAssetId(sell, buy);

    await signSendFinalized(
      Market.sellAsset(liq, sell, buy, amount),
      user2,
    ).catch(checkError(error));
    testLog.getLog().info("ExpectNoChange On:sellAssetFail");
    //https://mangatafinance.atlassian.net/browse/GASP-1872
    //await expectNoChange();
  }

  async function buyAssetFail(
    sell: BN,
    buy: BN,
    error = xykErrors.NotEnoughAssets,
  ) {
    const amount = new BN(20000);
    const liq = await getLiquidityAssetId(sell, buy);

    await signSendFinalized(
      Market.buyAsset(liq, sell, buy, amount),
      user2,
    ).catch(checkError(error));
    testLog.getLog().info("ExpectNoChange On:buyAssetFail");
    //https://mangatafinance.atlassian.net/browse/GASP-1872
    //await expectNoChange();
  }

  function checkError(error: xykErrors): (ev: EventResult) => void {
    return (ev) => {
      expect(ev.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(ev.data).toEqual(error);
    };
  }
});
