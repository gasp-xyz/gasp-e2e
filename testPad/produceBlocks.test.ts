import { ApiPromise } from "@polkadot/api";
import { sleep } from "../utils/utils";
import { testLog } from "../utils/Logger";
import { WsProvider } from "@polkadot/rpc-provider/ws";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

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

describe("Chopistics - run blocks", () => {
  test("brum brum", async () => {
    const ws = new WsProvider(`ws://127.0.0.1:8000`);
    const apiPromise = await ApiPromise.create({
      provider: ws,
      signedExtensions: {
        SetEvmOrigin: {
          extrinsic: {},
          payload: {},
        },
      },
    });
    await apiPromise.isReady;
    do {
      testLog.getLog().info("Blocks");
      const param = 1;
      ws.send("dev_newBlock", [param]);
      await sleep(3000);
    } while (true);
  });
});
