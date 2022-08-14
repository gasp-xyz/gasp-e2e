import {BN} from "@polkadot/util";
import {setupApi, setupUsers} from "../../../utils/v2/setup";
import {Sudo} from "../../../utils/v2/sudo";
import {Assets} from "../../../utils/v2/assets";
import {AssetWallet, User} from "../../../utils/User";
import {beforeAll, describe, expect, it} from "vitest";
import {signSendFinalized} from "../../../utils/v2/event";
import {Xyk} from "../../../utils/v2/xyk";

const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(50000);

// template
describe.skip("xyk-pallet", () => {
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

  it("xyk-pallet -", async () => {});
});
