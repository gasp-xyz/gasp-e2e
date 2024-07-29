/* eslint-disable no-console */
import { jest } from "@jest/globals";
import { testLog } from "../utils/Logger";
import dotenv from "dotenv";
import { setupApi, setupUsers } from "../utils/setup";
import { Keyring } from "@polkadot/api";
import { initApi } from "../utils/api";
import { User } from "../utils/User";
import { Mangata } from "gasp-sdk";

dotenv.config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

test("find all available functions in sdk.", async () => {
  await initApi();
  await setupApi();
  await setupUsers();
  const keyring = new Keyring({ type: "sr25519" });
  // setup users
  const testUser1 = new User(keyring);
  testLog.getLog().info(testUser1.keyRingPair.address);
  const s = Mangata.instance(["ws://127.0.0.1:9946"]);
  findMethods(s, 0);
  testLog.getLog().info(JSON.stringify(s));
});
function findMethods(o: any, num: number) {
  for (const a in o) {
    //@ts-ignore
    if (typeof o[a] === "function" && o.hasOwnProperty(a)) {
      let str = JSON.stringify(a);
      if (num > 0) {
        str = " -> " + str;
      }
      testLog.getLog().info(str);
    } else if (typeof o[a] === "object" && o.hasOwnProperty(a)) {
      testLog.getLog().info(JSON.stringify(a) + "::");
      findMethods(o[a], num++);
    }
  }
}
