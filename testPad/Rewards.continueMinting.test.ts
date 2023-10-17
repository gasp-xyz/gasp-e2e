/* eslint-disable no-console */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { MAX_BALANCE, MGA_ASSET_ID } from "../utils/Constants";
import { User } from "../utils/User";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../utils/utils";
import { mintLiquidity } from "../utils/tx";
import { testLog } from "../utils/Logger";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(5000000);
process.env.NODE_ENV = "test";
let testUser1, testUser2, testUser3, testUser4, sudo, keyring;

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

  //  const skipToBurn = false;
  //const tokenId = new BN(7);
  test("xyk-pallet: Setup evth and continue mintingl", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    testUser1 = new User(keyring, "//Ferdie");
    testUser2 = new User(keyring, "//Eve");
    testUser3 = new User(keyring, "//Dave");
    testUser4 = new User(keyring, "//Charlie");
    const users = [testUser1, testUser2, testUser3, testUser4];
    //    if(!skipToBurn){
    keyring.addPair(sudo.keyRingPair);
    testLog.getLog().info("FinalizeTGE and create a test token");
    const tokenId = new BN(8);
    for (let index = 0; index < 1000; index++) {
      const user = users[0];
      const tokenstoMint = new BN(100);
      testLog
        .getLog()
        .info(
          " User: " +
            user.keyRingPair.address +
            "Minting tokens to pool -2 users",
        );
      await mintLiquidity(
        user.keyRingPair,
        MGA_ASSET_ID,
        tokenId,
        tokenstoMint,
        MAX_BALANCE,
      );
      await waitForNBlocks(5);
    }
  });
});
