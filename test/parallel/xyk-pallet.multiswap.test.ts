/*
 *
 * @group multiswap
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calculate_sell_price_id_rpc,
  burnLiquidity,
  calculate_buy_price_id_rpc,
  multiSwapBuyMarket,
  multiSwapSellMarket,
  getLiquidityAssetId,
} from "../../utils/tx";
import {
  ExtrinsicResult,
  filterAndStringifyFirstEvent,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { User, AssetWallet } from "../../utils/User";
import { getUserBalanceOfToken } from "../../utils/utils";
import { setupApi, setup5PoolsChained, sudo } from "../../utils/setup";
import {
  getBalanceOfPool,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { BN_ONE, BN_TEN_THOUSAND, BN_ZERO } from "gasp-sdk";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Assets } from "../../utils/Assets";
import { BN_MILLION } from "gasp-sdk";
import { Sudo } from "../../utils/sudo";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const successSwapEventName = "AssetsSwapped";

let users: User[] = [];
let tokenIds: BN[] = [];

describe("Multiswap - happy paths", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    ({ users, tokenIds } = await setup5PoolsChained(users));
  });
  test("[gasless] Happy path - multi-swap - buy", async () => {
    const testUser1 = users[0];
    const boughtTokensBefore = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1,
    );
    const multiSwapOutput = await multiSwapBuyMarket(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND,
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1,
    );
    expect(boughtTokens.free.sub(boughtTokensBefore.free)).bnEqual(
      new BN(1000),
    );
    const transactionFee = (
      await filterAndStringifyFirstEvent(multiSwapOutput, "TransactionFeePaid")
    ).actualFee;
    expect(transactionFee).toEqual("0");
  });
  test("[gasless] Happy path - multi-swap - sell", async () => {
    const testUser1 = users[0];
    const boughtTokensBefore = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1,
    );
    const multiSwapOutput = await multiSwapSellMarket(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_ONE,
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1,
    );
    expect(boughtTokens.free.sub(boughtTokensBefore.free)).bnGt(new BN(0));
  });
  test("[gasless] Happy path - multi-swap uses feeLocks", async () => {
    const testUser2 = users[1];
    testUser2.addAssets(tokenIds);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    const multiSwapOutput = await multiSwapBuyMarket(
      testUser2,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND,
    );
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    const walletsModifiedInSwap = testUser2.getWalletDifferences();
    const mgaDiff = walletsModifiedInSwap.find((value) =>
      value.currencyId.eq(GASP_ASSET_ID),
    )?.diff;
    expect(mgaDiff?.free.add(mgaDiff?.reserved)).bnEqual(BN_ZERO);
    expect(mgaDiff?.reserved).bnGt(BN_ZERO);
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  test("[gasless] Fees - multi-swap roll backs all the swaps when one fail but we take fees in GASP tokens", async () => {
    let liqId: BN;
    let i = 0;

    const assetIdWithSmallPool = new BN(7);
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(assetIdWithSmallPool, sudo, new BN(1)),
      Assets.mintToken(tokenIds[tokenIds.length - 1], sudo, new BN(1)),
      Market.createPool(
        tokenIds[tokenIds.length - 1],
        new BN(1),
        assetIdWithSmallPool,
        new BN(1),
      ),
    );
    const swapAmount = new BN(100000);
    const testUser1 = users[2];
    const listIncludingSmallPool = tokenIds.concat([assetIdWithSmallPool]);
    testUser1.addAssets(listIncludingSmallPool);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    const tokenIdsLength = listIncludingSmallPool.length;
    const firstToken = listIncludingSmallPool[0];
    const lastToken = listIncludingSmallPool[tokenIdsLength - 1];
    const swapPoolList: BN[] = [];
    while (i < tokenIdsLength - 1) {
      liqId = await getLiquidityAssetId(tokenIds[i], tokenIds[i + 1]);
      swapPoolList.push(liqId);
      i++;
    }

    const multiswapSellEvent = await Market.multiswapAssetSell(
      swapPoolList,
      firstToken,
      swapAmount,
      lastToken,
      BN_TEN_THOUSAND,
    );
    const multiswapSellPaymentInfo = await multiswapSellEvent.paymentInfo(
      testUser1.keyRingPair,
    );
    const multiSwapOutput = await multiSwapSellMarket(
      testUser1,
      listIncludingSmallPool,
      swapAmount,
      BN_TEN_THOUSAND,
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("InsufficientOutputAmount");
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const walletsModifiedInSwap = testUser1.getWalletDifferences();
    //Validate that the modified tokens are only GASP in the list.
    expect(walletsModifiedInSwap).toHaveLength(1);
    expect(
      walletsModifiedInSwap.some((token) => token.currencyId.eq(GASP_ASSET_ID)),
    ).toBeTruthy();
    // expect(
    //   walletsModifiedInSwap.some((token) =>
    //     token.currencyId.eq(listIncludingSmallPool[0]),
    //   ),
    // ).toBeTruthy();
    const changeInSoldAsset = walletsModifiedInSwap.find((token) =>
      token.currencyId.eq(GASP_ASSET_ID),
    )?.diff.free;
    // const expectedFeeCharged = swapAmount
    //   .muln(3)
    //   .divn(1000)
    //   .add(new BN(3))
    //   .neg();
    expect(changeInSoldAsset).bnEqual(
      multiswapSellPaymentInfo.partialFee.neg(),
    );
  });
  test("[gasless] accuracy - Sum of calculate_sell_asset chained is equal to the multiswap operation", async () => {
    const testUser1 = users[0];
    const poolsBefore01 = await getBalanceOfPool(tokenIds[0], tokenIds[1]);
    const poolsBefore12 = await getBalanceOfPool(tokenIds[1], tokenIds[2]);
    const poolsBefore23 = await getBalanceOfPool(tokenIds[2], tokenIds[3]);
    const poolsBefore34 = (await getBalanceOfPool(
      tokenIds[3],
      tokenIds[4],
    )) as unknown as BN[][];
    const buy01 = await calculate_sell_price_id_rpc(
      tokenIds[0],
      tokenIds[1],
      new BN(1000),
    );
    const buy02 = await calculate_sell_price_id_rpc(
      tokenIds[1],
      tokenIds[2],
      buy01,
    );
    const buy03 = await calculate_sell_price_id_rpc(
      tokenIds[2],
      tokenIds[3],
      buy02,
    );
    const buy04 = await calculate_sell_price_id_rpc(
      tokenIds[3],
      tokenIds[4],
      buy03,
    );
    testUser1.addAssets(tokenIds);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const multiSwapOutput = await multiSwapSellMarket(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_ONE,
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const poolsAfter01 = await getBalanceOfPool(tokenIds[0], tokenIds[1]);
    const poolsAfter12 = await getBalanceOfPool(tokenIds[1], tokenIds[2]);
    const poolsAfter23 = await getBalanceOfPool(tokenIds[2], tokenIds[3]);
    const poolsAfter34 = await getBalanceOfPool(tokenIds[3], tokenIds[4]);
    //we buy sell [ 0 -> 1], [1 -> 2], [ 2-> 3]
    //assert pool1 diff is equal the bought amount.
    expect(poolsBefore01[0][1].sub(poolsAfter01[0][1])).bnEqual(buy01);
    expect(poolsBefore12[0][1].sub(poolsAfter12[0][1])).bnEqual(buy02);
    expect(poolsBefore23[0][1].sub(poolsAfter23[0][1])).bnEqual(buy03);
    expect(poolsBefore34[0][1].sub(poolsAfter34[0][1])).bnEqual(buy04);
    const userBoughtAssetWallet = testUser1.getAsset(
      tokenIds[tokenIds.length - 1],
    );
    const userSoldAssetWallet = testUser1.getAsset(tokenIds[0]);

    expect(
      userBoughtAssetWallet?.amountAfter.free.sub(
        userBoughtAssetWallet?.amountBefore.free,
      ),
    ).bnEqual(buy04);
    expect(
      userSoldAssetWallet?.amountBefore.free.sub(
        userSoldAssetWallet?.amountAfter.free,
      ),
    ).bnEqual(new BN(1000));
  });
  test("[gasless] accuracy - Sum of calculate_buy_asset chained is equal to the multiswap operation", async () => {
    const testUser1 = users[0];
    const poolsBefore01 = await getBalanceOfPool(tokenIds[0], tokenIds[1]);
    const poolsBefore12 = await getBalanceOfPool(tokenIds[1], tokenIds[2]);
    const poolsBefore23 = await getBalanceOfPool(tokenIds[2], tokenIds[3]);
    const poolsBefore34 = (await getBalanceOfPool(
      tokenIds[3],
      tokenIds[4],
    )) as unknown as BN[][];
    const buy01 = await calculate_buy_price_id_rpc(
      tokenIds[3],
      tokenIds[4],
      new BN(1000),
    );
    const buy02 = await calculate_buy_price_id_rpc(
      tokenIds[2],
      tokenIds[3],
      buy01,
    );
    const buy03 = await calculate_buy_price_id_rpc(
      tokenIds[1],
      tokenIds[2],
      buy02,
    );
    const buy04 = await calculate_buy_price_id_rpc(
      tokenIds[0],
      tokenIds[1],
      buy03,
    );
    testUser1.addAssets(tokenIds);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const multiSwapOutput = await multiSwapBuyMarket(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_MILLION,
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const poolsAfter01 = await getBalanceOfPool(tokenIds[0], tokenIds[1]);
    const poolsAfter12 = await getBalanceOfPool(tokenIds[1], tokenIds[2]);
    const poolsAfter23 = await getBalanceOfPool(tokenIds[2], tokenIds[3]);
    const poolsAfter34 = await getBalanceOfPool(tokenIds[3], tokenIds[4]);
    //we buy [ 0 -> 1], [1 -> 2], [ 2-> 3], so the operations are reversed:
    // [ 4,3 ] -> [ 3,2 ] -> [ 2,1 ] -> [ 1,0 ]
    //assert pool1 diff is equal the bought amount.
    expect(poolsBefore34[0][1].sub(poolsAfter34[0][1])).bnEqual(new BN(1000));
    expect(poolsBefore23[0][1].sub(poolsAfter23[0][1])).bnEqual(buy01);
    expect(poolsBefore12[0][1].sub(poolsAfter12[0][1])).bnEqual(buy02);
    expect(poolsBefore01[0][1].sub(poolsAfter01[0][1])).bnEqual(buy03);
    const userBoughtAssetWallet = testUser1.getAsset(
      tokenIds[tokenIds.length - 1],
    );
    const userSoldAssetWallet = testUser1.getAsset(tokenIds[0]);

    expect(
      userBoughtAssetWallet?.amountAfter.free.sub(
        userBoughtAssetWallet?.amountBefore.free,
      ),
    ).bnEqual(new BN(1000));
    expect(
      userSoldAssetWallet?.amountBefore.free.sub(
        userSoldAssetWallet?.amountAfter.free,
      ),
    ).bnEqual(buy04);
  });
  ///keep it on the last position, this test empty one pool!!!!
  test("[gasless] alternative scenario - one pool is highly unbalanced -> zero swap output", async () => {
    const testUser4 = users[3];
    //sudo burns in the last pool almost all of the tokens
    Assets.DEFAULT_AMOUNT.divn(2);
    await burnLiquidity(
      sudo.keyRingPair,
      tokenIds[tokenIds.length - 2],
      tokenIds[tokenIds.length - 1],
      Assets.DEFAULT_AMOUNT.divn(2).subn(1000),
    );
    const multiSwapOutput = await multiSwapSellMarket(
      testUser4,
      tokenIds.concat(GASP_ASSET_ID),
      Assets.DEFAULT_AMOUNT.divn(100000),
      BN_ONE,
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successSwapEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    testUser4.addAssets(tokenIds.concat(GASP_ASSET_ID));
    await testUser4.refreshAmounts(AssetWallet.BEFORE);
    //now only one token must be in the pool
    const multiSwapOutput2 = await multiSwapSellMarket(
      testUser4,
      tokenIds.concat(GASP_ASSET_ID),
      Assets.DEFAULT_AMOUNT.divn(100000),
      BN_ZERO,
    );
    const eventResponse2 = getEventResultFromMangataTx(multiSwapOutput2);
    expect(eventResponse2.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse2.data).toEqual("ZeroAmount");
    await testUser4.refreshAmounts(AssetWallet.AFTER);

    //check that we bought 0 tokens, but operation still works.
    expect(testUser4.getAsset(tokenIds[0])!.amountAfter.free).bnLt(
      testUser4.getAsset(tokenIds[0])!.amountBefore.free,
    );
  });
});
