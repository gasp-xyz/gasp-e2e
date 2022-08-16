import {
  calculateFees,
  calculateLiqAssetAmount,
  getEnvironmentRequiredVars,
  xykErrors,
} from "../../../utils/utils";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { keyring, setupApi, setupUsers } from "../../../utils/v2/setup";
import {
  calcuate_burn_liquidity_price_local,
  calcuate_mint_liquidity_price_local,
  calculate_buy_price_local,
  calculate_buy_price_rpc,
  calculate_sell_price_local,
  calculate_sell_price_rpc,
  getAssetSupply,
  getBalanceOfPool,
  getNextAssetId,
} from "../../../utils/tx";
import { BN_ONE, BN_ZERO } from "@mangata-finance/sdk";
import { Sudo } from "../../../utils/v2/sudo";
import { Assets } from "../../../utils/v2/assets";
import { BN } from "@polkadot/util";
import { Xyk } from "../../../utils/v2/xyk";
import { AssetWallet, User } from "../../../utils/User";
import { signSendFinalized } from "../../../utils/v2/event";
import { EventResult, ExtrinsicResult } from "../../../utils/eventListeners";

function assetsAfterFree(user: User): BN[] {
  return user.assets.map((asset) => asset.amountAfter.free);
}

function assetsBeforeFree(user: User): BN[] {
  return user.assets.map((asset) => asset.amountBefore.free);
}

describe.skip("xyk-pallet: Happy case scenario", () => {
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

    assetId1 = await getNextAssetId();
    assetId2 = assetId1.add(BN_ONE);
    liquidityAssetId = assetId2.add(BN_ONE);
    user1.addAsset(assetId1, Assets.DEFAULT_AMOUNT);
    user1.addAsset(assetId2, Assets.DEFAULT_AMOUNT);
    user1.addAsset(liquidityAssetId);
    user2.addAsset(assetId1);
    user2.addAsset(assetId2);
    user2.addAsset(liquidityAssetId);
    xykPalletUser.addAsset(assetId1);
    xykPalletUser.addAsset(assetId2);

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user1),
      Assets.mintNative(user2),
      Assets.issueToken(user1),
      Assets.issueToken(user1)
    );

    // remove native token, convenience for comparisons
    user1.assets.pop();
    user2.assets.pop();
  });

  beforeEach(async () => {
    await user1.refreshAmounts(AssetWallet.BEFORE);
    await user2.refreshAmounts(AssetWallet.BEFORE);
    await xykPalletUser.refreshAmounts(AssetWallet.BEFORE);
    poolBalanceBefore = await getBalanceOfPool(assetId1, assetId2);
    totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
  });

  it("xyk-pallet: create pool", async () => {
    const assetAmount1 = new BN(50000);
    const assetAmount2 = new BN(50000);

    await signSendFinalized(
      Xyk.createPool(assetId1, assetAmount1, assetId2, assetAmount2),
      user1
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const liquidityAssetsMinted = calculateLiqAssetAmount(
      assetAmount1,
      assetAmount2
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
      totalLiquidityAssets
    );
  });

  it("xyk-pallet: mint liquidity", async () => {
    const assetAmount1 = new BN(30000);
    const [assetAmount2, liquidityAssetsMinted] =
      await calcuate_mint_liquidity_price_local(
        assetId1,
        assetId2,
        assetAmount1
      );

    await signSendFinalized(
      Xyk.mintLiquidity(assetId1, assetId2, assetAmount1, assetAmount2),
      user1
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
      totalLiquidityAssets
    );
  });

  it("xyk-pallet: transfer", async () => {
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
      assetsAfterFree(xykPalletUser)
    );

    const poolBalance = await getBalanceOfPool(assetId1, assetId2);
    expect(poolBalanceBefore).collectionBnEqual(poolBalance);

    const totalLiquidityAssets = await getAssetSupply(liquidityAssetId);
    expect(totalLiquidityAssetsBefore).bnEqual(totalLiquidityAssets);
  });

  it("xyk-pallet: sell asset1", async () => {
    const amount = new BN(30000);
    const sellPriceLocal = calculate_sell_price_local(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount
    );
    const sellPriceRpc = await calculate_sell_price_rpc(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount
    );

    expect(sellPriceLocal).bnEqual(sellPriceRpc);

    await signSendFinalized(Xyk.sellAsset(assetId1, assetId2, amount), user2);

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
  });

  it("xyk-pallet: sell asset2", async () => {
    const amount = new BN(20000);
    const sellPriceLocal = calculate_sell_price_local(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount
    );
    const sellPriceRpc = await calculate_sell_price_rpc(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount
    );

    expect(sellPriceLocal).bnEqual(sellPriceRpc);

    await signSendFinalized(Xyk.sellAsset(assetId2, assetId1, amount), user2);

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
  });

  it("xyk-pallet: buy asset2", async () => {
    const amount = new BN(10000);
    const buyPriceLocal = calculate_buy_price_local(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount
    );
    const buyPriceRpc = await calculate_buy_price_rpc(
      poolBalanceBefore[0],
      poolBalanceBefore[1],
      amount
    );

    expect(buyPriceLocal).bnEqual(buyPriceRpc);

    await signSendFinalized(Xyk.buyAsset(assetId1, assetId2, amount), user2);

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
  });

  it("xyk-pallet: buy asset1", async () => {
    const amount = new BN(10000);
    const buyPriceLocal = calculate_buy_price_local(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount
    );
    const buyPriceRpc = await calculate_buy_price_rpc(
      poolBalanceBefore[1],
      poolBalanceBefore[0],
      amount
    );

    expect(buyPriceLocal).bnEqual(buyPriceRpc);

    await signSendFinalized(Xyk.buyAsset(assetId2, assetId1, amount), user2);

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
  });

  it("xyk-pallet: burn liquidity", async () => {
    const amount = new BN(20000);
    const [assetAmount1, assetAmount2] =
      await calcuate_burn_liquidity_price_local(assetId1, assetId2, amount);

    await signSendFinalized(
      Xyk.burnLiquidity(assetId1, assetId2, amount),
      user1
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
      totalLiquidityAssets
    );
  });
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
      assetsAfterFree(xykPalletUser)
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

    assetId1 = await getNextAssetId();
    assetId2 = assetId1.add(BN_ONE);
    liquidityAssetId = assetId2.add(BN_ONE);
    user1.addAsset(assetId1, Assets.DEFAULT_AMOUNT);
    user1.addAsset(assetId2, Assets.DEFAULT_AMOUNT);
    user1.addAsset(liquidityAssetId);
    user2.addAsset(assetId1);
    user2.addAsset(assetId2);
    user2.addAsset(liquidityAssetId);
    xykPalletUser.addAsset(assetId1);
    xykPalletUser.addAsset(assetId2);

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user1),
      Assets.mintNative(user2),
      Assets.issueToken(user1),
      Assets.issueToken(user1)
    );

    // remove native token, convenience for comparisons
    user1.assets.pop();
    user2.assets.pop();
  });

  beforeEach(async () => {
    await user1.refreshAmounts(AssetWallet.BEFORE);
    await user2.refreshAmounts(AssetWallet.BEFORE);
    await xykPalletUser.refreshAmounts(AssetWallet.BEFORE);
    poolBalanceBefore = await getBalanceOfPool(assetId1, assetId2);
    totalLiquidityAssetsBefore = await getAssetSupply(liquidityAssetId);
  });

  it("xyk-pallet: transfer asset1", async () => {
    const amount = new BN(100000);
    await signSendFinalized(Assets.transfer(user2, assetId1, amount), user1);

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user1.getAsset(assetId1)!.amountBefore.free.sub(amount),
      user1.getAsset(assetId2)!.amountBefore.free,
      BN_ZERO,
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free.add(amount),
      user2.getAsset(assetId2)!.amountBefore.free,
      BN_ZERO,
    ]).collectionBnEqual(assetsAfterFree(user2));
  });

  it("xyk-pallet: transfer asset2", async () => {
    const amount = new BN(100000);
    await signSendFinalized(Assets.transfer(user2, assetId2, amount), user1);

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);

    expect([
      user1.getAsset(assetId1)!.amountBefore.free,
      user1.getAsset(assetId2)!.amountBefore.free.sub(amount),
      BN_ZERO,
    ]).collectionBnEqual(assetsAfterFree(user1));

    expect([
      user2.getAsset(assetId1)!.amountBefore.free,
      user2.getAsset(assetId2)!.amountBefore.free.add(amount),
      BN_ZERO,
    ]).collectionBnEqual(assetsAfterFree(user2));
  });

  it("xyk-pallet: create pool", async () => {
    const assetAmount1 = new BN(60000);
    const assetAmount2 = new BN(60000);

    await signSendFinalized(
      Xyk.createPool(assetId1, assetAmount1, assetId2, assetAmount2),
      user1
    );

    await user1.refreshAmounts(AssetWallet.AFTER);
    await user2.refreshAmounts(AssetWallet.AFTER);
    await xykPalletUser.refreshAmounts(AssetWallet.AFTER);
    const liquidityAssetsMinted = calculateLiqAssetAmount(
      assetAmount1,
      assetAmount2
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
      totalLiquidityAssets
    );
  });

  it("xyk-pallet: mint liquidity", async () => {
    await mint(user1, user2);
  });

  it("xyk-pallet: mint liquidity, user2", async () => {
    await mint(user2, user1);
  });

  it("xyk-pallet: burn more liquidity than they have", async () => {
    await burnLiquidityFail(user1);
  });

  it("xyk-pallet: burn more liquidity than they have, user2", async () => {
    await burnLiquidityFail(user2);
  });

  it("xyk-pallet: burn all liquidity", async () => {
    await burnAll(user1, user2);
  });

  it("xyk-pallet: burn more liquidity than they have, user2 has 100% of the pool", async () => {
    await burnLiquidityFail(user2);
  });

  it("xyk-pallet: burn all liquidity, user2", async () => {
    await burnAll(user2, user1);
  });

  it("xyk-pallet: burn liquidity from empty pool", async () => {
    const amount = new BN(10000);

    await signSendFinalized(
      Xyk.burnLiquidity(assetId1, assetId2, amount),
      user2
    ).catch(checkError(xykErrors.NoSuchPool));

    await expectNoChange();
  });

  it("xyk-pallet: sell asset1 from empty pool", async () => {
    await sellAssetFail(assetId1, assetId2);
  });

  it("xyk-pallet: sell asset2 from empty pool", async () => {
    await sellAssetFail(assetId2, assetId1);
  });

  it("xyk-pallet: buy asset1 from empty pool", async () => {
    await buyAssetFail(assetId1, assetId2);
  });

  it("xyk-pallet: buy asset2 from empty pool", async () => {
    await buyAssetFail(assetId2, assetId1);
  });

  async function mint(user: User, other: User) {
    const assetAmount1 = new BN(20000);
    const [assetAmount2, liquidityAssetsMinted] =
      await calcuate_mint_liquidity_price_local(
        assetId1,
        assetId2,
        assetAmount1
      );

    await signSendFinalized(
      Xyk.mintLiquidity(assetId1, assetId2, assetAmount1, assetAmount2),
      user
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
      totalLiquidityAssets
    );
  }

  async function burnAll(user: User, other: User) {
    const amount = user.getAsset(liquidityAssetId)!.amountBefore.free;
    const [assetAmount1, assetAmount2] =
      await calcuate_burn_liquidity_price_local(assetId1, assetId2, amount);

    await signSendFinalized(
      Xyk.burnLiquidity(assetId1, assetId2, amount),
      user
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
      totalLiquidityAssets
    );
  }

  async function burnLiquidityFail(user: User) {
    const assetsBurned = user.getAsset(liquidityAssetId)!.amountBefore.free;
    const excess = assetsBurned.mul(new BN(105)).div(new BN(100));

    await signSendFinalized(
      Xyk.burnLiquidity(assetId1, assetId2, excess),
      user
    ).catch(checkError(xykErrors.NotEnoughAssets));

    await expectNoChange();
  }

  async function sellAssetFail(sell: BN, buy: BN) {
    const amount = new BN(20000);

    await signSendFinalized(Xyk.sellAsset(sell, buy, amount), user2).catch(
      checkError(xykErrors.NoSuchPool)
    );

    await expectNoChange();
  }

  async function buyAssetFail(sell: BN, buy: BN) {
    const amount = new BN(20000);

    await signSendFinalized(Xyk.buyAsset(sell, buy, amount), user2).catch(
      checkError(xykErrors.NoSuchPool)
    );

    await expectNoChange();
  }

  function checkError(error: xykErrors): (ev: EventResult) => void {
    return (ev) => {
      expect(ev.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(ev.data).toEqual(error);
    };
  }
});
