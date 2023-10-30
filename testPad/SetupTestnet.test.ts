import { Keyring } from "@polkadot/api";
import { getApi, getMangataInstance, initApi } from "../utils/api";
import { User } from "../utils/User";
import fs from "fs";
import { BN } from "@polkadot/util";
import { createPoolIfMissing } from "../utils/tx";

import "dotenv/config";

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

  test("SetupTestNet", async () => {
    keyring = new Keyring({ type: "sr25519" });
    //const destUser = `5Ew7ERfihWfWRqWeozvf9CSEGV9qMMWmQa2bWMhUopc4PsGn`;
    const fileLocation = `/home/goncer/accounts/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY.json`;
    const fileLocationSudo = `/home/goncer/accounts/5CthcoS3CYHoVHDMUacydayRLMzMWedKryjsrvzrmv3VHCKP.json`;
    const json = fs.readFileSync(fileLocation, {
      encoding: "utf8",
      flag: "r",
    });
    const jsonSudo = fs.readFileSync(fileLocationSudo, {
      encoding: "utf8",
      flag: "r",
    });
    const user = new User(keyring, "aasd", JSON.parse(json));
    const sudo = new User(keyring, "aasd2", JSON.parse(jsonSudo));
    keyring.addPair(user.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    keyring.pairs[1].decodePkcs8("mangata123");

    await createPoolIfMissing(
      sudo,
      "1800000000000000000000000000000000",
      new BN(0),
      new BN(1),
    );
    const mga = await getMangataInstance();
    await mga.mintLiquidity(
      user.keyRingPair,
      new BN(1).toString(),
      new BN(0).toString(),
      new BN("1800000000000000000000000000000000"),
      new BN("2700000000000000000000000000000000"),
    );

    //    const promises: any[] = [];
    //    [3, 2, 0].forEach((tokenId) => {
    //      promises.push(
    //        mga.transferTokenAll(user.keyRingPair, tokenId.toString(), destUser)
    //      );
    //    });
    //    await Promise.all(promises);
  });
});
//3: [
//  18,000,000,000,000,000,000,000
//  27,000,000,000,000,000,000,000
//]
