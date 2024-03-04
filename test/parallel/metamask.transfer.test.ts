/*
 *
 * @group metamask
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { signTxMetamask } from "../../utils/metamask";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("Metamask test", () => {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  let testUser1: User;
  let sudo: User;
  let ethUser: User;

  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    [testUser1] = setupUsers();
    sudo = new User(keyring, sudoUserName);
    ethUser = new User(keyring);
    ethUser.addFromAddress(
      keyring,
      "5FeifGJWHVnuKiRR8WcHbQtwxvwr3RbagVRhBJiKTkzmbfB5",
    );

    await setupApi();
    setupUsers();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(sudo),
      Assets.mintNative(ethUser),
    );
    testUser1.addAsset(MGA_ASSET_ID);
    ethUser.addAsset(MGA_ASSET_ID);
  });

  test("Try transfer tokens", async () => {
    const api = getApi();
    const ethUserAddress = "0x9428406f4f4b467B7F5B8d6f4f066dD9d884D24B";
    const ethPrivateKey =
      "0x2faacaa84871c08a596159fe88f8b2d05cf1ed861ac3d963c4a15593420cf53f";

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await ethUser.refreshAmounts(AssetWallet.BEFORE);

    const tx = api.tx.tokens.transfer(testUser1.keyRingPair.address, 0, 1000);
    expect(tx).not.toBeEmpty();
    await signTxMetamask(tx, ethUserAddress, ethPrivateKey, ethUser);
    await waitForNBlocks(4);

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await ethUser.refreshAmounts(AssetWallet.AFTER);
    const diff = testUser1.getWalletDifferences();

    expect(ethUser.getAsset(MGA_ASSET_ID)!.amountBefore.free!).bnGt(
      ethUser.getAsset(MGA_ASSET_ID)!.amountAfter.free!,
    );
    expect(diff[0].diff.free).bnEqual(new BN(1000));
  });
});
