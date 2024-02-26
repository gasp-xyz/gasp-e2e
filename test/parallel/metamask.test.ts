/*
 *
 * @group metamask
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { signTxMetamask } from "../../utils/metamask";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

describe("xyk-pallet - Sell assets tests: SellAsset Errors:", () => {
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

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);

    await Sudo.batchAsSudoFinalized(
      Assets.FinalizeTge(),
      Assets.initIssuance(),
      Assets.mintNative(testUser1),
      Assets.mintNative(sudo),
    );
  });

  test("Try sell more assets than owned", async () => {
    const api = getApi();
    const tx = api.tx.tokens.transfer(testUser1.keyRingPair.address, 0, 1000);
    await signTxMetamask(tx);
  });
});
