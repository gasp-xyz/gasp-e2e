/*
 *
 * @group xyk
 * @group api
 * @group sequential
 */
import { BN } from "@polkadot/util";
import { setupApi, setupUsers, testUser1 } from "../../../utils/v2/setup";
import { Sudo } from "../../../utils/v2/sudo";
import { Assets } from "../../../utils/v2/assets";
import {
  calculate_sell_price_id_rpc,
  calculate_sell_price_local_no_fee,
  getBalanceOfPool,
  getNextAssetId,
  getTreasury,
  getTreasuryBurn,
} from "../../../utils/tx";
import { MGA_ASSET_ID } from "../../../utils/Constants";
import { AssetWallet } from "../../../utils/User";
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getTokensDiffForBlockAuthor,
} from "../../../utils/utils";
import { Fees } from "../../../utils/Fees";
import { beforeEach, describe, expect } from "vitest";
import { signSendFinalized } from "../../../utils/v2/event";
import { Xyk } from "../../../utils/v2/xyk";

let currency1: BN;
let currency2: BN;
const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(50000);
const defaultCurrencyValue = new BN(250000);

describe("XYK MGA fees test suite", () => {
  beforeEach(async () => {
    await setupApi();
    setupUsers();

    currency1 = MGA_ASSET_ID;
    currency2 = await getNextAssetId();

    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser1),
      Assets.issueToken(testUser1, defaultCurrencyValue),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(
          currency1,
          firstAssetAmount,
          currency2,
          secondAssetAmount
        )
      )
    );
    testUser1.addAsset(currency1);
    testUser1.addAsset(currency2);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
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
      testUser1
    );
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    let tokensLost = testUser1
      .getAsset(currency1)
      ?.amountBefore.free.sub(testUser1.getAsset(currency1)?.amountAfter.free!);

    const tokensWon = testUser1
      .getAsset(currency2)
      ?.amountAfter.free.sub(
        testUser1.getAsset(currency2)?.amountBefore.free!
      )!;
    let feesPaid = new BN(0);
    if (Fees.swapFeesEnabled) {
      const to = await getBlockNumber();
      const blockNumber = await findBlockWithExtrinsicSigned(
        [from, to],
        testUser1.keyRingPair.address
      );
      const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
      feesPaid = authorMGAtokens;
      tokensLost = tokensLost?.sub(feesPaid);
    }
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
