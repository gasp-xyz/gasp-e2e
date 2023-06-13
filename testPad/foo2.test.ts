/* eslint-disable no-console */
import { jest } from "@jest/globals";
import { testLog } from "../utils/Logger";
import dotenv from "dotenv";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { initApi } from "../utils/api";
import { getEnvironmentRequiredVars } from "../utils/utils";
import { User } from "../utils/User";
import { getBalanceOfAsset } from "../utils/tx";

dotenv.config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

test("asdasdasd", async () => {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  const defaultCurrecyValue = new BN(250000);
  await initApi();
  const keyring = new Keyring({ type: "sr25519" });

  // setup users
  const testUser1 = new User(keyring);
  const sudo = new User(keyring, sudoUserName);
  testLog.getLog().info(testUser1.keyRingPair.address);
  await setupApi();
  await setupUsers();
  const s = await getBalanceOfAsset(new BN(0), testUser1);
  const [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo
  );

  testLog.getLog().info(JSON.stringify(firstCurrency));
  testLog.getLog().info(JSON.stringify(secondCurrency));
  testLog.getLog().info(JSON.stringify(s));
});
