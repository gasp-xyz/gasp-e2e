import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { api, getApi, initApi } from "../utils/api";
import { MGA_ASSET_ID } from "../utils/Constants";
import { User, AssetWallet } from "../utils/User";
import { getEnvironmentRequiredVars } from "../utils/utils";
import fs from "fs";
import signTx from "../utils/TxRetry";
import { mintLiquidity } from "../utils/tx";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1, sudo, keyring;

//*******HOW TO USE******** */
//install JEST run it extension for vs code.
//export env. variables.
//run xyk-pallet: Create new users with bonded amounts.
// this ^^ will create json files with User_address as name.
// You can import those files into polkadotJS.
// If you want to use any action, write in the const address the user address to trigger the action.
// this will load the .json and perform the extrinsic action.
// have fun!
//*******END:HOW TO USE******** */

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
  //const address = "5Dy7VqFgArCo6PVFAVgSjEHace12vABr1doNM8uWbENDwUzC"; // <--candidate1
  //const address = "5CUuPs8noEQHo9rk7tbd4BxBYcUkJmNpQ8rDyV3c6uXYjrnK"; // <--candidate2
  //const address = "5GGbPY2kmf2CQCTVKL8FkGDst6JQWF7bfk8FCbQj2HkuHosK"; // <--vote to candidate1
  //const address = "5CPFKKg6cUH2XRzzg3Zb4UYVY1cTUzrxUFiqzbF94voStUZx"; // SUDO!
  //const address = "5H8QjhHEtbrttHDJL4ha5Kry2KBgLkerB6cbKFSfJqG44tcW"; // aura!
  //const address = "5HLsUSDLyQjDSNriuhzbzWBNEbfXjUjt5WmALLpQkLLCU2Ex"; // granpa

  //  const address = "5FRL15Qj6DdoULKswCz7zevqe97bnHuEix794pTeGK7MhfDS"; // pair1
  const address_2 =
    "/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY";

  const address_1 =
    "/home/goncer/5FfBQ3kwXrbdyoqLPvcXRp7ikWydXawpNs2Ceu3WwFdhZ8W4";
  //    const address =
  //      "/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY";

  test.each([address_1, address_2])(
    "xyk-pallet: Create new users with bonded amounts.",
    async (address) => {
      const file = await fs.readFileSync(address + ".json");
      keyring = new Keyring({ type: "sr25519" });
      sudo = new User(keyring, sudoUserName);
      testUser1 = new User(keyring, "asd", JSON.parse(file));
      await fs.writeFileSync(
        testUser1.keyRingPair.address + ".json",
        JSON.stringify(testUser1.keyRingPair.toJson("mangata123"))
      );
      await fs.writeFileSync(
        sudo.keyRingPair.address + ".json",
        JSON.stringify(sudo.keyRingPair.toJson("mangata123"))
      );
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      keyring.addPair(sudo.keyRingPair);
      keyring.pairs[0].decodePkcs8("mangata123");
      await testUser1.refreshAmounts(AssetWallet.BEFORE);

      const { nonce } = await api.query.system.account(
        sudo.keyRingPair.address
      );
      await signTx(
        api,
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            MGA_ASSET_ID,
            testUser1.keyRingPair.address,
            new BN("10000000000000000000")
          )
        ),
        sudo.keyRingPair,
        { nonce: new BN(nonce) }
      );
      const nonce2 = await (
        await api.query.system.account(sudo.keyRingPair.address)
      ).nonce;
      await signTx(
        api,
        api.tx.sudo.sudo(
          api.tx.tokens.mint(
            new BN(4),
            testUser1.keyRingPair.address,
            new BN("10000000000000000000")
          )
        ),
        sudo.keyRingPair,
        { nonce: new BN(nonce2.toNumber()) }
      );
      await createPoolIfMissing(
        sudo,
        "10000000000000000000",
        MGA_ASSET_ID,
        new BN(4)
      );
      await mintLiquidity(
        testUser1.keyRingPair,
        MGA_ASSET_ID,
        new BN(4),
        new BN("1000000000000000"),
        new BN("1000000000000001")
      );
    }
  );
});
