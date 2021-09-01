import { getApi, initApi } from "../../../../utils/api";
import { waitNewBlock } from "../../../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../../../utils/User";
import { Assets } from "../../../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../../../utils/utils";
import BN from "bn.js";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("xyk-pallet - Burn liquidity tests: when burning liquidity you can", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;

  //creating pool

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    await waitNewBlock();
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);
    await Assets.setupUserWithCurrencies(
      testUser1,
      [new BN(20000), new BN(25550)],
      sudo
    );
    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
  });

  test("Test0", async () => {
    while (true) {
      await testUser1.addMGATokens(sudo);
    }
  });
});
