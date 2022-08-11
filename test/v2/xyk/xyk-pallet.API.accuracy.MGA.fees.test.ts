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
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getTokensDiffForBlockAuthor,
} from "../../../utils/utils";
import { beforeEach, describe, expect, it } from "vitest";
import { signSendFinalized } from "../../../utils/v2/event";
import { Xyk } from "../../../utils/v2/xyk";

const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(50000);

// not used in current CI setup
describe.skip("XYK MGA fees test suite", () => {
  let user: User;
  let currency1: BN;
  let currency2: BN;

  beforeEach(async () => {
    await setupApi();
    [user] = setupUsers();

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user),
      Assets.issueToken(user)
    ).then(async (result) => {
      [currency1, currency2] = Assets.findTokenId(result);
      user.addAsset(currency1);
      user.addAsset(currency2);

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

  it("xyk-pallet - Assets substracted are incremented by 1 - MGA- SellAsset", async () => {
    const sellingAmount = new BN(10000);
    const tokensToReceive = await calculate_sell_price_id_rpc(
      currency1,
      currency2,
      sellingAmount
    );
    //10000 - 0.3% = 9970.
    //selling the amount without the fee.
    const exangeValue = await calculate_sell_price_local_no_fee(
      secondAssetAmount,
      firstAssetAmount,
      new BN(9970)
    );
    const treasuryBefore = await getTreasury(currency1);
    const treasuryBurnBefore = await getTreasuryBurn(currency1);
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.sellAsset(currency1, currency2, sellingAmount),
      user
    );
    await user.refreshAmounts(AssetWallet.AFTER);
    let tokensLost = user
      .getAsset(currency1)
      ?.amountBefore.free.sub(user.getAsset(currency1)?.amountAfter.free!);

    const tokensWon = user
      .getAsset(currency2)
      ?.amountAfter.free.sub(user.getAsset(currency2)?.amountBefore.free!)!;
    const to = await getBlockNumber();
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      user.keyRingPair.address
    );
    const feesPaid = await getTokensDiffForBlockAuthor(blockNumber);
    tokensLost = tokensLost?.sub(feesPaid);
    expect(tokensWon).bnEqual(tokensToReceive);
    expect(tokensLost).bnEqual(sellingAmount);
    expect(exangeValue).bnEqual(tokensWon);

    //0.05% = 5 tokens.
    const extraTokenForRounding = new BN(1);
    const expectedTreasury = new BN(5);
    const treasury = await getTreasury(currency1);
    const treasuryBurn = await getTreasuryBurn(currency1);

    const incrementedTreasury = treasuryBefore
      .sub(treasury)
      .sub(feesPaid)
      .abs();
    expect(incrementedTreasury).bnEqual(
      expectedTreasury.add(extraTokenForRounding)
    );
    expect(treasuryBurnBefore.sub(treasuryBurn)).bnEqual(treasuryBurnBefore);

    //the other pool_fee tokens must be in the pool.
    const poolBalance = await getBalanceOfPool(currency1, currency2);
    //adding treasury twice beacuse is burned.
    expect(
      poolBalance[0].add(incrementedTreasury).add(incrementedTreasury)
    ).bnEqual(firstAssetAmount.add(sellingAmount));
  });
});
