import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { api, getApi, initApi } from "../utils/api";
import { User, AssetWallet } from "../utils/User";
import { getEnvironmentRequiredVars } from "../utils/utils";
import fs from "fs";
import { signTx } from "mangata-sdk";
import { ApiPromise } from "@polkadot/api";
import { WsProvider } from "@polkadot/rpc-provider/ws";
import { options } from "@mangata-finance/types";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { chainUri } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1, keyring;

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
  //  const address_2 =
  //    "/home/goncer/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY";

  const address_1 =
    "/home/goncer/5FfBQ3kwXrbdyoqLPvcXRp7ikWydXawpNs2Ceu3WwFdhZ8W4";

  //  const address_3 =
  //    "/home/goncer/5FRL15Qj6DdoULKswCz7zevqe97bnHuEix794pTeGK7MhfDS";
  //
  //  const address_4 =
  //    "/home/goncer/5H6YCgW24Z8xJDvxytQnKTwgiJGgye3uqvfQTprBEYqhNbBy";

  const liqtokenId = new BN(5);

  test.each([address_1])("xyk-pallet: claim rewards", async (user) => {
    while (true) {
      const address = user;
      const file = await fs.readFileSync(address + ".json");
      keyring = new Keyring({ type: "sr25519" });
      testUser1 = new User(keyring, "asd", JSON.parse(file.toString()));
      // add users to pair.
      keyring.addPair(testUser1.keyRingPair);
      keyring.pairs[0].decodePkcs8("mangata123");
      await testUser1.refreshAmounts(AssetWallet.BEFORE);
      const provider = new WsProvider(chainUri);
      const api2 = await new ApiPromise(options({ provider })).isReady;
      const result = await (api2.rpc as any).xyk.calculate_rewards_amount(
        testUser1.keyRingPair.address,
        liqtokenId
      );
      await signTx(
        api,
        api.tx.xyk.claimRewards(
          liqtokenId,
          new BN(result.notYetClaimed.toString()).add(
            new BN(result.toBeClaimed.toString())
          )
        ),
        testUser1.keyRingPair
        // eslint-disable-next-line no-loop-func
      ).then((result) => {
        fs.appendFile(
          `/home/goncer/claims.txt`,
          result.toString(),
          function (err) {
            if (err) throw err;
            // eslint-disable-next-line no-console
            console.log("error" + err);
          }
        );
      });
    }
  });
});
