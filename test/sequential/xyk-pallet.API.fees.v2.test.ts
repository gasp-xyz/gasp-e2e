import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { BN_HUNDRED, BN_THOUSAND, BN_ZERO } from "gasp-sdk";
import { AssetWallet, User } from "../../utils/User";
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getFeeLockMetadata,
  getTokensDiffForBlockAuthor,
} from "../../utils/utils";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Xyk } from "../../utils/xyk";
import { Assets } from "../../utils/Assets";
import { signSendFinalized } from "../../utils/sign";
import { getApi } from "../../utils/api";
import { SudoDB } from "../../utils/SudoDB";
/**
 * @group xyk
 * @group api
 * @group sequential
 * @group critical
 */
describe("API fees test suite", () => {
  let currency1: BN;
  let currency2: BN;
  let currency3: BN;
  let currency4: BN;
  let user1: User;
  let user2: User;

  beforeAll(async () => {
    await setupApi();
    [user1, user2] = setupUsers();
    currency1 = await SudoDB.getInstance().getTokenId();
    currency2 = await SudoDB.getInstance().getTokenId();
    currency3 = await SudoDB.getInstance().getTokenId();
    currency4 = await SudoDB.getInstance().getTokenId();
    user1.addAsset(currency1);
    user1.addAsset(currency2);

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(currency1, user1),
      Assets.mintToken(currency2, user1),
      Assets.mintToken(currency3, user1),
      Assets.mintToken(currency4, user1),
      Assets.mintToken(currency1, user2), // transferAll test
      Assets.mintNative(user1),
      Assets.mintNative(user2),
      Sudo.sudoAs(
        user1,
        Xyk.createPool(currency1, BN_THOUSAND, currency2, BN_THOUSAND),
      ),
    );
  });

  beforeEach(async () => {
    await user1.refreshAmounts(AssetWallet.BEFORE);
    await user2.refreshAmounts(AssetWallet.BEFORE);
  });

  async function expectFeePaid(from: number, to: number, user: User) {
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      user.keyRingPair.address,
    );
    const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
    await user.refreshAmounts(AssetWallet.AFTER);
    const mgaUserToken = user.getAsset(GASP_ASSET_ID)!;
    const diff = mgaUserToken.amountBefore.free.sub(
      mgaUserToken.amountAfter.free!,
    );
    expect(BN_ZERO).bnLt(diff);
    expect(BN_ZERO).bnLt(authorMGAtokens);
    expect(authorMGAtokens).bnEqual(diff);
  }
  async function expectGasLessSwapFrozenTokens(
    from: number,
    to: number,
    user: User,
  ) {
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      user.keyRingPair.address,
    );
    const authorMGAtokens = await getTokensDiffForBlockAuthor(blockNumber);
    await user.refreshAmounts(AssetWallet.AFTER);
    const mgaUserToken = user.getAsset(GASP_ASSET_ID)!;
    const diff = mgaUserToken.amountBefore.free.sub(
      mgaUserToken.amountAfter.free!,
    );
    const diffReserved = mgaUserToken.amountBefore.reserved.sub(
      mgaUserToken.amountAfter.reserved!,
    );
    const swapFee = await getFeeLockMetadata(await getApi());
    expect(swapFee.feeLockAmount).bnEqual(diff);
    expect(BN_ZERO).bnEqual(authorMGAtokens);
    expect(diffReserved).bnEqual(swapFee.feeLockAmount.neg());
  }

  it("xyk-pallet - MGA tokens are subtracted as fee : CreatePool", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.createPool(currency3, BN_THOUSAND, currency4, BN_HUNDRED),
      user1,
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : MintLiquidity", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.mintLiquidity(currency1, currency2, BN_THOUSAND),
      user1,
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : BurnLiquidity", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.burnLiquidity(currency1, currency2, BN_THOUSAND),
      user1,
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : Transfer", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Assets.transfer(user2, currency1, BN_THOUSAND),
      user1,
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : TransferAll", async () => {
    user2.addAsset(currency1, BN_ZERO);
    const from = await getBlockNumber();
    await signSendFinalized(Assets.transferAll(user1, currency1), user2);
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user2);
  });

  it("xyk-pallet - MGA tokens are not subtracted as fee : SellAsset", async () => {
    const from = await getBlockNumber();
    //those currencies are not in whitelist -> hence tokens are reserved.
    await signSendFinalized(
      Xyk.sellAsset(currency1, currency2, new BN(50)),
      user1,
    );
    const to = await getBlockNumber();

    await expectGasLessSwapFrozenTokens(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are / are not subtracted as fee : BuyAsset", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.buyAsset(currency1, currency2, new BN(50)),
      user1,
    );
    const to = await getBlockNumber();

    await expectGasLessSwapFrozenTokens(from, to, user1);
  });
});
