/*
 *
 * @group ui
 */
import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import {
  BTC_ASSET_NAME,
  DOT_ASSET_NAME,
  FIVE_MIN,
  MGA_ASSET_ID,
  MGA_ASSET_NAME,
  USDC_ASSET_NAME,
} from "../../utils/Constants";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  addExtraLogs,
} from "../../utils/frontend/utils/Helper";
import { getAllAssets } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";

//time-out to 7.5 min.Faucet takes some time.
jest.setTimeout(FIVE_MIN * 1.5);

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
    await validateAllAssetsValues(mga);

    //lets validate one asset to check if environment is correctly configured.
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free).bnEqual(
      new BN("10000000000000000000")
    );
    const assets = await getAllAssets(testUser1.keyRingPair.address);
    expect(assets.length).toBeGreaterThanOrEqual(0);
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
    await driver.quit();
    await DriverBuilder.destroy();
  });
});
async function validateAllAssetsValues(mga: Mangata, value = "10.000") {
  const promises: Promise<string>[] = [];
  [MGA_ASSET_NAME, DOT_ASSET_NAME, BTC_ASSET_NAME, USDC_ASSET_NAME].forEach(
    async function (value) {
      promises.push(mga.getAssetValue(value));
    }
  );
  const result = await Promise.all(promises);
  expect(result.every((x) => x === value)).toBeTruthy();
}
