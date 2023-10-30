/*
 *
 * @group xyk
 * @group calculate
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { burnLiquidity, getBalanceOfPool, getBurnAmount } from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_ZERO } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const defaultCurrencyAmount = new BN(100000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

describe("xyk-rpc - calculate get_burn amount: OK", () => {
  const dictAssets = new Map<number, BN>();

  beforeAll(async () => {
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    const keyring = new Keyring({ type: "sr25519" });
    const sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);

    //the idea of this mess is to have some pools with different values,
    //pool1 [0,1]: with [defaultCurrencyAmount,defaultCurrencyAmount]
    const assetIds = await Assets.setupUserWithCurrencies(
      sudo,
      [defaultCurrencyAmount, defaultCurrencyAmount],
      sudo,
    );
    const assetValues = [defaultCurrencyAmount, defaultCurrencyAmount];
    for (let index = 0; index < assetIds.length; index++) {
      dictAssets.set(index, assetIds[index]);
      if (index < assetIds.length - 1) {
        await sudo.createPoolToAsset(
          new BN(assetValues[index]),
          new BN(assetValues[index + 1]),
          assetIds[index],
          assetIds[index + 1],
        );
      }
    }
  });
  //now with the dict indexes we do the testing.
  //ie, pool1, assets(0 and 1) in the dictionary, requesting amount of 0 , we expect 1. Weird.
  test.each([
    [0, 1, new BN(1000), new BN(1000)],
    [1, 0, new BN(1000), new BN(1000)],
    [0, 1, new BN(10000), new BN(10000)],
    [0, 1, new BN(100000), new BN(100000)],
  ])(
    "validate parameters - burn from pool [firstIdx->%s,secondIdx->%s,amount->%s,expected->%s]",
    async (firstIdx, secondIdx, amount, expected) => {
      const burnAmount = await getBurnAmount(
        dictAssets.get(firstIdx)!,
        dictAssets.get(secondIdx)!,
        amount,
      );
      expect(burnAmount.firstAssetAmount).bnEqual(expected);
      expect(burnAmount.secondAssetAmount).bnEqual(expected);
    },
  );
});

describe("xyk-rpc - calculate get_burn amount: Missing requirements", () => {
  const dictAssets = new Map<number, BN>();

  beforeAll(async () => {
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    const keyring = new Keyring({ type: "sr25519" });
    const sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);

    //the idea of this mess is to have some pools with different values,
    //pool1 [0,1]: with [defaultCurrencyAmount,defaultCurrencyAmount]
    const assetIds = await Assets.setupUserWithCurrencies(
      sudo,
      [defaultCurrencyAmount, defaultCurrencyAmount],
      sudo,
    );
    for (let index = 0; index < assetIds.length; index++) {
      dictAssets.set(index, assetIds[index]);
    }
  });
  //now with the dict indexes we do the testing.
  //ie, pool1, assets(0 and 1) in the dictionary, requesting amount of 0 , we expect 1. Weird.
  test.each([[0, 1, new BN(1000), new BN(0)]])(
    "validate parameters - get_burn from not generated pool [soldTokenId->%s,boughtTokenId->%s,amount->%s,expected->%s]",
    async (firstIdx, secondIdx, amount, expected) => {
      const burnAmount = await getBurnAmount(
        dictAssets.get(firstIdx)!,
        dictAssets.get(secondIdx)!,
        amount,
      );
      expect(burnAmount.firstAssetAmount).bnEqual(expected);
      expect(burnAmount.secondAssetAmount).bnEqual(expected);
    },
  );

  test("validate parameters - get_burn from not created assets", async () => {
    const burnAmount = await getBurnAmount(
      new BN(12345),
      new BN(12346),
      new BN(10000000),
    );
    expect(burnAmount.firstAssetAmount).bnEqual(BN_ZERO);
    expect(burnAmount.secondAssetAmount).bnEqual(BN_ZERO);
  });
});

describe("xyk-rpc - calculate get_burn amount: RPC result matches with burn amount", () => {
  let sudo: User;
  let firstAssetId: BN;
  let secondAssetId: BN;

  beforeAll(async () => {
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    const keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);

    const assetIds = await Assets.setupUserWithCurrencies(
      sudo,
      [defaultCurrencyAmount, defaultCurrencyAmount],
      sudo,
    );
    firstAssetId = assetIds[0];
    secondAssetId = assetIds[1];

    await sudo.createPoolToAsset(
      new BN(defaultCurrencyAmount),
      new BN(defaultCurrencyAmount.sub(new BN(12345))),
      firstAssetId,
      secondAssetId,
    );
  });

  test("validate get_burn_amount that matches with real burn operation", async () => {
    await sudo.refreshAmounts(AssetWallet.BEFORE);
    const toBurn = new BN(defaultCurrencyAmount).div(new BN(2));
    const burnAmount = await getBurnAmount(firstAssetId, secondAssetId, toBurn);
    const poolBefore = await getBalanceOfPool(firstAssetId, secondAssetId);

    await burnLiquidity(
      sudo.keyRingPair,
      firstAssetId,
      secondAssetId,
      toBurn,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityBurned",
        sudo.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await sudo.refreshAmounts(AssetWallet.AFTER);
    const poolAfter = await getBalanceOfPool(firstAssetId, secondAssetId);

    expect(new BN(burnAmount.firstAssetAmount)).bnEqual(
      poolBefore[0].sub(poolAfter[0]),
    );
    expect(new BN(burnAmount.secondAssetAmount)).bnEqual(
      poolBefore[1].sub(poolAfter[1]),
    );

    expect(sudo.getAsset(firstAssetId)?.amountAfter.free!).bnEqual(
      new BN(burnAmount.firstAssetAmount),
    );
    expect(
      sudo
        .getAsset(secondAssetId)
        ?.amountAfter.free.sub(
          sudo.getAsset(secondAssetId)?.amountBefore.free!,
        )!,
    ).bnEqual(new BN(burnAmount.secondAssetAmount));
  });
});
