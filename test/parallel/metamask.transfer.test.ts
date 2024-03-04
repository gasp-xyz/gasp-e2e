/*
 *
 * @group metamask
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { signTxMetamask } from "../../utils/metamask";
import { testLog } from "../../utils/Logger";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { EthUser } from "../../utils/EthUser";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("Metamask test", () => {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  let testUser1: User;
  let sudo: User;
  let testEthUser: EthUser;

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
    testEthUser = new EthUser(keyring);

    await setupApi();
    setupUsers();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(sudo),
      Assets.mintNative(testEthUser.pdUser),
    );
    testUser1.addAsset(MGA_ASSET_ID);
    testEthUser.pdUser.addAsset(MGA_ASSET_ID);
  });

  test("Try transfer tokens", async () => {
    const api = getApi();

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    await testEthUser.pdUser.refreshAmounts(AssetWallet.BEFORE);

    const tx = api.tx.tokens.transfer(testUser1.keyRingPair.address, 0, 1000);
    const extrinsicFromBlock = await signTxMetamask(
      tx,
      testEthUser.ethAddress,
      testEthUser.privateKey,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    testLog
      .getLog()
      .info("Extrinsic from block", JSON.stringify(extrinsicFromBlock));

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testEthUser.pdUser.refreshAmounts(AssetWallet.AFTER);
    const diff = testUser1.getWalletDifferences();

    expect(testEthUser.pdUser.getAsset(MGA_ASSET_ID)!.amountBefore.free!).bnGt(
      testEthUser.pdUser.getAsset(MGA_ASSET_ID)!.amountAfter.free!,
    );
    expect(diff[0].diff.free).bnEqual(new BN(1000));
  });
});
