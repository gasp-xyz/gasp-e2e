import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../../utils/v2/setup";
import { Sudo } from "../../../utils/v2/sudo";
import { Assets } from "../../../utils/v2/assets";
import {
  calculate_sell_price_id_rpc,
  calculate_sell_price_local_no_fee,
  getBalanceOfPool,
  getTreasury,
  getTreasuryBurn,
} from "../../../utils/tx";
import { AssetWallet, User } from "../../../utils/User";
import { beforeAll, describe, expect, it } from "vitest";
import { signSendFinalized } from "../../../utils/v2/event";
import { Xyk } from "../../../utils/v2/xyk";

const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(50000);

describe("xyk-pallet accuracy not connected test suite", () => {
  let user: User;
  let currency1: BN;
  let currency2: BN;

  beforeAll(async () => {
    await setupApi();
    [user] = setupUsers();

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user),
      Assets.issueToken(user),
      Assets.issueToken(user)
    ).then(async (result) => {
      [currency1, currency2] = Assets.findTokenId(result);
      user.addAsset(currency1);
      user.addAsset(currency2);

      await user.refreshAmounts(AssetWallet.BEFORE);
      expect([
        user.getAsset(currency1)!.amountBefore.free,
        user.getAsset(currency2)!.amountBefore.free,
      ]).collectionBnEqual([Assets.DEFAULT_AMOUNT, Assets.DEFAULT_AMOUNT]);

      await signSendFinalized(
        Xyk.createPool(
          currency1,
          firstAssetAmount,
          currency2,
          secondAssetAmount
        ),
        user
      );
    });

    await user.refreshAmounts(AssetWallet.BEFORE);
  });

  it("xyk-pallet - Assets subtracted are incremented by 1 - SellAsset", async () => {
    const sellingAmount = new BN(10000);
    const tokensToReceive = await calculate_sell_price_id_rpc(
      currency1,
      currency2,
      sellingAmount
    );
    //10000 - 0.3% = 9970.
    //selling the amount without the fee.
    const exchangeValue = await calculate_sell_price_local_no_fee(
      secondAssetAmount,
      firstAssetAmount,
      new BN(9970)
    );
    await signSendFinalized(
      Xyk.sellAsset(currency1, currency2, sellingAmount),
      user
    );
    await user.refreshAmounts(AssetWallet.AFTER);
    const tokensLost = user
      .getAsset(currency1)
      ?.amountBefore.free.sub(user.getAsset(currency1)?.amountAfter.free!);
    const tokensWon = user
      .getAsset(currency2)
      ?.amountAfter.free.sub(user.getAsset(currency2)?.amountBefore.free!)!;

    expect(tokensWon).bnEqual(tokensToReceive);
    expect(tokensLost).bnEqual(sellingAmount);
    expect(exchangeValue).bnEqual(tokensWon);

    //0.05% = 5 tokens.
    const extraTokenForRounding = new BN(1);
    const expectedTreasury = new BN(5);
    const treasury = await getTreasury(currency1);
    const treasuryBurn = await getTreasuryBurn(currency1);

    expect(treasury).bnEqual(expectedTreasury.add(extraTokenForRounding));
    expect(treasuryBurn).bnEqual(expectedTreasury.add(extraTokenForRounding));

    //the other pool_fee tokens must be in the pool.
    const poolBalance = await getBalanceOfPool(currency1, currency2);
    expect(poolBalance[0].add(treasury).add(treasuryBurn)).bnEqual(
      firstAssetAmount.add(sellingAmount)
    );
  });
});
