/*
 *
 * @group ui
 */
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { FIVE_MIN, MGA_ASSET_ID } from "../../utils/Constants";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DepositModal } from "../../utils/frontend/pages/DepositModal";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  takeScreenshot,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI main tests - Deposit to MGA", () => {
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

    const mga = new Mangata(driver);
    await mga.navigate();
    const getTokensAvailable = await mga.isGetTokensVisible();
    const sidebar = new Sidebar(driver);
    const ableToContinueM = await sidebar.isMetamaskExtensionOK();
    const ableToContinueP = await sidebar.isPolkadotExtensionOK();
    expect(getTokensAvailable).toBeTruthy();
    expect(ableToContinueM).toBeTruthy();
    expect(ableToContinueP).toBeTruthy();
  });

  it("As a User I can get test tokens from Meta extension", async () => {
    const sidebar = new Sidebar(driver);
    await sidebar.clickOnDepositToMangata();
    const modal = new DepositModal(driver);
    await modal.selectToken("kETH");
    await modal.enterValue("0.001");
    await modal.clickContinue();
    await modal.confirmAndSign();
    await sidebar.waitForTokenToAppear("mETH");
    const tokenValue = sidebar.getTokenAmount("mETH");
    expect(tokenValue).toEqual("0.001");
  });

  afterEach(async () => {
    const sidebar = new Sidebar(driver);
    await sidebar.withdrawAllAssetsToMetaMask("mETH");
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
