/*
 *
 * @group ui
 */
import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  takeScreenshot,
} from "../../utils/frontend/utils/Helper";
import { getAllAssets } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { MGA_ASSET_ID } from "../../utils/utils";

jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

//Required env vars:
//export API_URL=wss://staging.testnode.mangata.finance:9945
//export UI_URL='https://staging.mangata.finance/' ;
//export MNEMONIC_META='dismiss .. trumpet' ( Ask Gonzalo :) )

describe("UI tests - Get Tokens from Faucet", () => {
  let testUser1: User;
  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
  });

  beforeEach(async () => {
    driver = await DriverBuilder.getInstance();

    const { polkUserAddress } = await setupAllExtensions(driver);

    testUser1 = new User(keyring, undefined);
    testUser1.addFromAddress(keyring, polkUserAddress);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  it("As a User I can get test tokens from the faucet", async () => {
    const mga = new Mangata(driver);
    await mga.navigate();
    const getTokensAvailable = await mga.isGetTokensVisible();
    expect(getTokensAvailable).toBeTruthy();
    await mga.clickOnGetTokens();
    await mga.waitForFaucetToGenerateTokens();
    const tokens = await mga.getAssetValue();
    expect(tokens).toBe("10.000");
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter).bnEqual(
      new BN("10000000000000000000")
    );
    const assets = await getAllAssets(testUser1.keyRingPair.address);
    expect(assets.length).toBeGreaterThanOrEqual(0);
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await takeScreenshot(
      driver,
      expect.getState().currentTestName + " - " + session
    );
    await driver.quit();
    const api = getApi();
    await api.disconnect();
  });
});
