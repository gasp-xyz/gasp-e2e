/*
 *
 * @group autocompound
 * @group story
 */
import { getApi, initApi } from "../../utils/api";
import { multiSwapBuy, multiSwapSell } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { User, AssetWallet } from "../../utils/User";
import { getUserBalanceOfToken } from "../../utils/utils";
import { setupApi, setup5PoolsChained } from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_ONE, BN_TEN_THOUSAND, BN_ZERO } from "@mangata-finance/sdk";
import { MGA_ASSET_ID } from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const successMultiSwapBuyEventName = "AssetsMultiBuySwapped";
const successMultiSwapSellEventName = "AssetsMultiBuySwapped";
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
    const multiSwapOutput = await multiSwapBuy(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapSellEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
  test("[gasless] Happy path - multi-swap - sell", async () => {
    const testUser1 = users[0];
    const multiSwapOutput = await multiSwapSell(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_ONE
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapBuyEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
  test("[gasless] Happy path - multi-swap uses feeLocks", async () => {
    const testUser2 = users[1];
    testUser2.addAssets(tokenIds);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
    const multiSwapOutput = await multiSwapBuy(
      testUser2,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    await testUser2.refreshAmounts(AssetWallet.AFTER);
    const walletsModifiedInSwap = testUser2.getWalletDifferences();
    const mgaDiff = walletsModifiedInSwap.find((value) =>
      value.currencyId.eq(MGA_ASSET_ID)
    )?.diff;
    expect(mgaDiff?.free.add(mgaDiff?.reserved)).bnEqual(BN_ZERO);
    expect(mgaDiff?.reserved).bnGt(BN_ZERO);
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapBuyEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  test("[gasless] Fees - multi-swap roll backs all the swaps when one fail but 0.3% is charged", async () => {
    const assetIdNotPairedInSetup = new BN(7);
    const swapAmount = new BN(100000);
    const testUser1 = users[0];
    const listWithUnpairedToken = [...tokenIds];
    testUser1.addAssets(listWithUnpairedToken);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    listWithUnpairedToken.push(new BN(assetIdNotPairedInSetup));
    const multiSwapOutput = await multiSwapSell(
      testUser1,
      listWithUnpairedToken,
      swapAmount,
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      "MultiSellAssetFailedOnAtomicSwap",
    ]);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const walletsModifiedInSwap = testUser1.getWalletDifferences();
    //Validate that the modified tokens are MGX and the first element in the list.
    expect(walletsModifiedInSwap).toHaveLength(2);
    expect(
      walletsModifiedInSwap.some((token) => token.currencyId.eq(MGA_ASSET_ID))
    ).toBeTruthy();
    expect(
      walletsModifiedInSwap.some((token) =>
        token.currencyId.eq(listWithUnpairedToken[0])
      )
    ).toBeTruthy();
    const changeInSoldAsset = walletsModifiedInSwap.find((token) =>
      token.currencyId.eq(listWithUnpairedToken[0])
    )?.diff.free;
    const expectedFeeCharged = swapAmount
      .muln(3)
      .divn(1000)
      .neg()
      .add(new BN(3));
    expect(changeInSoldAsset).bnEqual(expectedFeeCharged);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    //check only 0.3%
  });
  test("[gasless] Happy path - multi-swap uses pools as regular swaps : assert pool statuses", async () => {
    //TODO: Test need to be completed.
    expect(true).toBeFalsy();
    const testUser1 = users[0];
    const multiSwapOutput = await multiSwapBuy(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapBuyEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
  test.skip("[gasless] alternative scenario - one pool does not have liquidity :O", async () => {
    //TODO: Test need to be completed.
    expect(true).toBeFalsy();
    const testUser1 = users[0];
    const multiSwapOutput = await multiSwapBuy(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapBuyEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
  test.skip("[gasless] accuracy - Sum of calculate_sell_asset chained is equal to the multiswap operation", async () => {
    //TODO: Test need to be completed.
    expect(true).toBeFalsy();
    const testUser1 = users[0];
    const multiSwapOutput = await multiSwapBuy(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapBuyEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
  test.skip("[gasless] accuracy - Sum of calculate_buy_asset chained is equal to the multiswap operation", async () => {
    //TODO: Test need to be completed.
    expect(true).toBeFalsy();
    const testUser1 = users[0];
    const multiSwapOutput = await multiSwapBuy(
      testUser1,
      tokenIds,
      new BN(1000),
      BN_TEN_THOUSAND
    );
    const eventResponse = getEventResultFromMangataTx(multiSwapOutput, [
      "xyk",
      successMultiSwapBuyEventName,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    const boughtTokens = await getUserBalanceOfToken(
      tokenIds[tokenIds.length - 1],
      testUser1
    );
    expect(boughtTokens.free).bnEqual(new BN(1000));
  });
});
