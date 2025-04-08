/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  sellAsset,
  buyAsset,
  calculate_buy_price_rpc,
  createPool,
  calculate_buy_price_id_rpc,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateTreasuryAmountsEqual } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { calculateFees } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { getSudoUser } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const first_asset_amount = new BN(50000);
const defaultCurrecyValue = new BN(250000);

describe("xyk-pallet - treasury tests [No Mangata]: on treasury we store", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

  //creating pool

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    keyring = new Keyring({ type: "ethereum" });

    // setup users
    testUser1 = new User(keyring);

    sudo = getSudoUser();

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue, defaultCurrecyValue],
      sudo,
    );
    await testUser1.addGASPTokens(sudo);
    await createPool(
      testUser1.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      first_asset_amount.div(new BN(2)),
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("assets won when assets are sold - 5 [no connected to MGA]", async () => {
    const sellAssetAmount = new BN(10000);

    await sellAsset(
      testUser1.keyRingPair,
      secondCurrency,
      firstCurrency,
      sellAssetAmount,
      new BN(1),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const { treasury, treasuryBurn } = calculateFees(sellAssetAmount);

    await validateTreasuryAmountsEqual(firstCurrency, [new BN(0), new BN(0)]);
    await validateTreasuryAmountsEqual(secondCurrency, [
      treasury,
      treasuryBurn,
    ]);
  });
  test("assets won when assets are sold - 1 [rounding] [no connected to MGA]", async () => {
    const sellAssetAmount = new BN(500);

    await sellAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      sellAssetAmount,
      new BN(1),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(sellAssetAmount);
    await validateTreasuryAmountsEqual(firstCurrency, [treasury, treasuryBurn]);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });

  test("assets won when assets are bought - 2 [no connected to MGA]", async () => {
    const buyAssetAmount = new BN(10000);
    const sellPriceRpc = await calculate_buy_price_id_rpc(
      firstCurrency,
      secondCurrency,
      buyAssetAmount,
    );
    await buyAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      buyAssetAmount,
      testUser1.getFreeAssetAmount(firstCurrency).amountBefore.free,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(sellPriceRpc);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
    //treasuries are stored always in the sold asset
    await validateTreasuryAmountsEqual(firstCurrency, [treasury, treasuryBurn]);
  });

  test("assets won when assets are bought - 1 [no connected to MGA]", async () => {
    const buyAssetAmount = new BN(100);
    const sellPriceRpc = await calculate_buy_price_rpc(
      first_asset_amount,
      first_asset_amount.div(new BN(2)),
      buyAssetAmount,
    );
    await buyAsset(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      buyAssetAmount,
      testUser1.getFreeAssetAmount(firstCurrency).amountBefore.free,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const { treasury, treasuryBurn } = calculateFees(sellPriceRpc);
    await validateTreasuryAmountsEqual(firstCurrency, [treasury, treasuryBurn]);
    await validateTreasuryAmountsEqual(secondCurrency, [new BN(0), new BN(0)]);
  });
});
