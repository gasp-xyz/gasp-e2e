import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { getApi, initApi } from "./utils/api";
import { MGA_ASSET_ID, ETH_ASSET_ID } from "./utils/Constants";
import { setupAllExtensions } from "./utils/frontend/utils/Helper";
import { testLog } from "./utils/Logger";
import { User, AssetWallet } from "./utils/User";
import { getEnvironmentRequiredVars } from "./utils/utils";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { xykPalletAddress, sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

test("xyk-pallet: Happy case scenario", async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  const keyring = new Keyring({ type: "sr25519" });
  const sudo = new User(keyring, sudoUserName);
  const testUser1 = new User(keyring);
  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(ETH_ASSET_ID);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await sudo.mint(MGA_ASSET_ID, testUser1, new BN(100000));
});
