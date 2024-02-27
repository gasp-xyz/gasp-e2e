/*
 *
 * @group metamask
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { signTxMetamask } from "../../utils/metamask";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("Metamask test", () => {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  let testUser1: User;
  let sudo: User;

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

    await setupApi();
    setupUsers();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(sudo),
      Sudo.sudo(
        Assets.mintTokenAddress(
          MGA_ASSET_ID,
          "5FeifGJWHVnuKiRR8WcHbQtwxvwr3RbagVRhBJiKTkzmbfB5",
          Assets.DEFAULT_AMOUNT,
        ),
      ),
    );
  });

  test("Try transfer tokens", async () => {
    const api = getApi();
    const tx = api.tx.tokens.transfer(testUser1.keyRingPair.address, 0, 1000);
    await signTxMetamask(tx);
  });
});
