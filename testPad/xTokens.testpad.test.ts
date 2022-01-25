import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { getApi, initApi } from "../utils/api";
import { testLog } from "../utils/Logger";
import { signSendAndWaitToFinishTx } from "../utils/txHandler";
import { User } from "../utils/User";
import { getEnvironmentRequiredVars } from "../utils/utils";
import { Mangata } from "mangata-sdk";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let keyring;

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
  //const address = "5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY"; // michal

  //    const address =
  //      "/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY";

  test("V4 xtokens transfer", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.getInstance(getEnvironmentRequiredVars().chainUri);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Charlie");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.xTokens.transfer(
        new BN(4),
        new BN("200000000000"),
        {
          V1: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: 2001,
                },
                {
                  AccountId32: {
                    network: "Any",
                    id: "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
                  },
                },
              ],
            },
          },
        },
        new BN("6000000000")
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });

  test("V4 xtokens transferToRely", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.getInstance(getEnvironmentRequiredVars().chainUri);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.polkadotXcm.reserveTransferAssets(
        {
          V1: {
            parents: 1,
            interior: "Here",
          },
        },
        {
          V1: {
            parents: 1,
            interior: {
              X1: {
                AccountId32: {
                  network: "Any",
                  id: "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
                },
              },
            },
          },
        },
        {
          V1: [
            {
              id: {
                Concrete: {
                  parents: 1,
                  interior: "Here",
                },
              },
              fun: {
                Fungible: new BN("100000000000"),
              },
            },
          ],
        },
        new BN("0")
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });
});
