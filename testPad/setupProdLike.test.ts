/* eslint-disable no-console */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { provisionBootstrap, scheduleBootstrap } from "../utils/tx";
import { GASP_ASSET_ID } from "../utils/Constants";
import { User } from "../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForBootstrapStatus,
} from "../utils/utils";

import { Sudo } from "../utils/sudo";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";
import { setAssetInfo } from "../utils/txHandler";
import "dotenv/config";
import { Market } from "../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let sudo;

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

describe("Boostrap - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  test("Step1: Create bootstrap + asset registry + pools + bootstrap for pool 0-4->5", async () => {
    await getApi();
    const keyring = new Keyring({ type: "sr25519" });
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    await setupApi();
    await setupUsers();
    const testUser1 = new User(keyring, "//Ferdie");
    const user1 = new User(keyring, "//Eve");
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(new BN(4), testUser1), // transferAll test
      Assets.mintToken(new BN(4), testUser1), // transferAll test
      Assets.mintToken(new BN(7), testUser1), // transferAll test
      Assets.mintNative(testUser1),
      Assets.mintToken(new BN(7), user1),
      Assets.mintToken(new BN(4), user1),
      Assets.mintNative(user1),
      Assets.mintNative(user1),
      Sudo.sudoAs(
        user1,
        Market.createPool(
          GASP_ASSET_ID,
          new BN("1000000000000000000000"),
          new BN(7),
          new BN("10000000000000"),
        ),
      ),
      Sudo.sudoAs(
        testUser1,
        Market.createPool(
          new BN(4),
          new BN("1000000000000000"),
          new BN(7),
          new BN("10000000000000"),
        ),
      ),
    );
    const blockstostart = 5;
    const bootstraplength = 10;
    await scheduleBootstrap(
      sudo,
      GASP_ASSET_ID,
      new BN(4),
      blockstostart,
      bootstraplength,
      1,
    );
    await waitForBootstrapStatus("Public", 6);
    await provisionBootstrap(testUser1, new BN(4), new BN("10000000000000000"));
    await provisionBootstrap(
      testUser1,
      GASP_ASSET_ID,
      new BN("1000000000000000000000"),
    );
    await setAssetInfo(sudo, new BN(4), "KSM", "KSM", "", new BN(12));
    await setAssetInfo(sudo, new BN(7), "TUR", "TUR", "", new BN(10));

    await waitForBootstrapStatus("Finished", bootstraplength);
    //pool created Id 5.
  });
});
