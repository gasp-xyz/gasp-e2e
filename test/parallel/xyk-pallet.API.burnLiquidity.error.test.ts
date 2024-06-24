/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  getBalanceOfPool,
  getLiquidityAssetId,
  getBalanceOfAsset,
  burnLiquidity,
} from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateUnmodified } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { UserCreatesAPoolAndMintLiquidity, xykErrors } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { getSudoUser } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const defaultCurrecyValue = new BN(250000);

describe("xyk-pallet - Burn liquidity tests: BurnLiquidity Errors:", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;
  let secondCurrency: BN;

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
    await testUser1.addMGATokens(sudo);
  });

  test("Burn liquidity assets that does not belong to any pool", async () => {
    const [firstCurrency, secondCurrency] =
      await Assets.setupUserWithCurrencies(
        testUser1,
        [defaultCurrecyValue, defaultCurrecyValue],
        sudo,
      );

    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(1),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NoSuchPool);
    });
  });

  test("Burn liquidity  for more assets than the liquidity pool has issued", async () => {
    const poolAmount = new BN(defaultCurrecyValue).div(new BN(2));
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintLiquidity(
      testUser1,
      sudo,
      new BN(defaultCurrecyValue),
      poolAmount,
    );
    const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    const liquidityBalance = (
      await getBalanceOfAsset(liquidityAssetId, testUser1)
    ).free;
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await burnLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      liquidityBalance.add(new BN(1)),
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });

    await validateUnmodified(
      firstCurrency,
      secondCurrency,
      testUser1,
      poolBalance,
    );
  });

  test("Burn someone else liquidities", async () => {
    //create a new user
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    await testUser2.addMGATokens(sudo);
    [firstCurrency, secondCurrency] = await UserCreatesAPoolAndMintLiquidity(
      testUser1,
      sudo,
      new BN(defaultCurrecyValue),
    );

    const liquidityAssetId = await getLiquidityAssetId(
      firstCurrency,
      secondCurrency,
    );
    testUser1.addAsset(liquidityAssetId);
    const aFewAssetsToBurn = new BN(1000);

    await burnLiquidity(
      testUser2.keyRingPair,
      firstCurrency,
      secondCurrency,
      aFewAssetsToBurn,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual(xykErrors.NotEnoughAssets);
    });
  });
});
