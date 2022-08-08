/*
 *
 * @group xyk
 * @group api
 * @group sequential
 * @group critical
 */

import { BN } from "@polkadot/util";
import {
  setupApi,
  setupUsers,
  testUser1,
  testUser2,
} from "../../../utils/v2/setup";
import { getNextAssetId } from "../../../utils/tx";
import { Sudo } from "../../../utils/v2/sudo";
import { Assets } from "../../../utils/v2/assets";
import { BN_HUNDRED, BN_ONE, BN_THOUSAND, BN_ZERO } from "@mangata-finance/sdk";
import { AssetWallet, User } from "../../../utils/User";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getTokensDiffForBlockAuthor,
} from "../../../utils/utils";
import { MGA_ASSET_ID } from "../../../utils/Constants";
import { signSendFinalized } from "../../../utils/v2/event";
import { Xyk } from "../../../utils/v2/xyk";
import { Fees } from "../../../utils/Fees";

let currency1: BN;
let currency2: BN;

describe("API fees test suite", () => {
  beforeAll(async () => {
    await setupApi();
    setupUsers();

    currency1 = await getNextAssetId();
    currency2 = currency1.add(BN_ONE);

    await Sudo.batchAsSudoFinalized(
      Assets.issueToken(testUser1),
      Assets.issueToken(testUser1),
      Assets.issueToken(testUser1), // createPool test
      Assets.issueToken(testUser1), // createPool test
      Assets.mintToken(currency1, testUser2), // transferAll test
      Assets.mintNative(testUser1),
      Assets.mintNative(testUser2),
      Sudo.sudoAs(
        testUser1,
        Xyk.createPool(currency1, BN_THOUSAND, currency2, BN_THOUSAND)
      )
    );
    testUser1.addAsset(currency1);
    testUser1.addAsset(currency2);
  });

  beforeEach(async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await testUser2.refreshAmounts(AssetWallet.BEFORE);
  });

  async function expectFeePaid(from: number, to: number, user: User) {
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      user.keyRingPair.address
    );
    const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
    await user.refreshAmounts(AssetWallet.AFTER);
    const mgaUserToken = user.getAsset(MGA_ASSET_ID)!;
    const diff = mgaUserToken.amountBefore.free.sub(
      mgaUserToken.amountAfter.free!
    );
    expect(new BN(0)).bnLt(diff);
    expect(new BN(0)).bnLt(authorMGAtokens);
    expect(authorMGAtokens).bnEqual(diff);
  }

  /*
  async function expectFeePaidSwap(from: number, to: number, user: User) {
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      user.keyRingPair.address
    );
    const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
    await user.refreshAmounts(AssetWallet.AFTER);
    const mgaUserToken = user.getAsset(MGA_ASSET_ID)!;
    const diff = mgaUserToken.amountBefore.free.sub(
      mgaUserToken.amountAfter.free!
    );

    expect(user.getAsset(currency1)!.amountAfter.free).bnLt(
      user.getAsset(currency1)!.amountBefore.free
    );
    expect(new BN(0)).bnEqual(authorMGAtokens);
    expect(diff).bnEqual(new BN(0));
    expect(user.getAsset(MGA_ASSET_ID)!.amountBefore.free).bnEqual(
      user.getAsset(MGA_ASSET_ID)!.amountAfter.free!
    );
  }
*/

  it("xyk-pallet - MGA tokens are subtracted as fee : CreatePool", async () => {
    const currency3 = currency2.add(BN_ONE);
    const currency4 = currency3.add(BN_ONE);

    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.createPool(currency3, BN_THOUSAND, currency4, BN_HUNDRED),
      testUser1
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, testUser1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : MintLiquidity", async () => {
    const from = await getBlockNumber();

    await signSendFinalized(
      Xyk.mintLiquidity(currency1, currency2, BN_THOUSAND),
      testUser1
    );
    const to = await getBlockNumber();
    await expectFeePaid(from, to, testUser1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : BurnLiquidity", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.burnLiquidity(currency1, currency2, BN_THOUSAND),
      testUser1
    );
    const to = await getBlockNumber();
    await expectFeePaid(from, to, testUser1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : Transfer", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Assets.transfer(testUser2, currency1, BN_THOUSAND),
      testUser1
    );
    const to = await getBlockNumber();
    await expectFeePaid(from, to, testUser1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : TransferAll", async () => {
    testUser2.addAsset(currency1, BN_ZERO);
    const from = await getBlockNumber();
    await signSendFinalized(
      Assets.transferAll(testUser1, currency1),
      testUser2
    );
    const to = await getBlockNumber();
    await expectFeePaid(from, to, testUser2);
  });

  it("xyk-pallet - MGA tokens are not subtracted as fee : SellAsset", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.sellAsset(currency1, currency2, new BN(50)),
      testUser1
    );
    const to = await getBlockNumber();
    //TODO:swapFees:plz remove me when fees are fixed and keep the else part.
    if (Fees.swapFeesEnabled) {
      await expectFeePaid(from, to, testUser1);
    } else {
      // await expectFeePaidSwap(from, to, testUser1);
    }
  });

  it("xyk-pallet - MGA tokens are / are not subtracted as fee : BuyAsset", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.buyAsset(currency1, currency2, new BN(50)),
      testUser1
    );
    const to = await getBlockNumber();
    //TODO:swapFees:plz remove me when fees are fixed and keep the else part.
    if (Fees.swapFeesEnabled) {
      await expectFeePaid(from, to, testUser1);
    } else {
      // await expectFeePaidSwap(from, to, testUser1);
    }
  });
});
