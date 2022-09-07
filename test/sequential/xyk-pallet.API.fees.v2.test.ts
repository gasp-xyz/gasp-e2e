import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { BN_HUNDRED, BN_ONE, BN_THOUSAND, BN_ZERO } from "@mangata-finance/sdk";
import { AssetWallet, User } from "../../utils/User";
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getTokensDiffForBlockAuthor,
} from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Xyk } from "../../utils/xyk";
import { getNextAssetId } from "../../utils/tx";
import { Assets } from "../../utils/Assets";
import { signSendFinalized } from "../../utils/eventListeners";

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
    currency1 = await getNextAssetId();
    currency2 = currency1.add(BN_ONE);
    currency3 = currency2.add(BN_ONE);
    currency4 = currency3.add(BN_ONE);
    user1.addAsset(currency1);
    user1.addAsset(currency2);

    await Sudo.batchAsSudoFinalized(
      Assets.issueToken(user1),
      Assets.issueToken(user1),
      Assets.issueToken(user1), // createPool test
      Assets.issueToken(user1), // createPool test
      Assets.mintToken(currency1, user2), // transferAll test
      Assets.mintNative(user1),
      Assets.mintNative(user2),
      Sudo.sudoAs(
        user1,
        Xyk.createPool(currency1, BN_THOUSAND, currency2, BN_THOUSAND)
      )
    );
  });

  beforeEach(async () => {
    await user1.refreshAmounts(AssetWallet.BEFORE);
    await user2.refreshAmounts(AssetWallet.BEFORE);
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
    expect(BN_ZERO).bnLt(diff);
    expect(BN_ZERO).bnLt(authorMGAtokens);
    expect(authorMGAtokens).bnEqual(diff);
  }

  it("xyk-pallet - MGA tokens are subtracted as fee : CreatePool", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.createPool(currency3, BN_THOUSAND, currency4, BN_HUNDRED),
      user1
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : MintLiquidity", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.mintLiquidity(currency1, currency2, BN_THOUSAND),
      user1
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : BurnLiquidity", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.burnLiquidity(currency1, currency2, BN_THOUSAND),
      user1
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are subtracted as fee : Transfer", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Assets.transfer(user2, currency1, BN_THOUSAND),
      user1
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
    await signSendFinalized(
      Xyk.sellAsset(currency1, currency2, new BN(50)),
      user1
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });

  it("xyk-pallet - MGA tokens are / are not subtracted as fee : BuyAsset", async () => {
    const from = await getBlockNumber();
    await signSendFinalized(
      Xyk.buyAsset(currency1, currency2, new BN(50)),
      user1
    );
    const to = await getBlockNumber();

    await expectFeePaid(from, to, user1);
  });
});
