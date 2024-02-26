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
import { setupApi } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

describe("Metamask test", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    await setupApi();

    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(sudo.keyRingPair);
    keyring.addPair(testUser1.keyRingPair);
  });

  test("Try transfer tokens", async () => {
    const api = getApi();
    const tx = api.tx.tokens.transfer(testUser1.keyRingPair.address, 0, 1000);
    await signTxMetamask(tx);
  });
});
