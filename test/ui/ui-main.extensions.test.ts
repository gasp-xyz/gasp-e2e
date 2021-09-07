import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { waitNewBlock } from "../../utils/eventListeners";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { Swap } from "../../utils/frontend/pages/Swap";
import { Pool } from "../../utils/frontend/pages/Pool";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  takeScreenshot,
} from "../../utils/frontend/utils/Helper";
import { getBalanceOfPool } from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";
import {
  FIVE_MIN,
  getEnvironmentRequiredVars,
  mETH_ASSET_NAME,
  MGA_ASSET_NAME,
} from "../../utils/utils";

const MGA_ASSET_ID = new BN(0);
const ETH_ASSET_ID = new BN(1);

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - Extension management", () => {
  //  let keyring: Keyring;

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  it("As a User I get infomed whenever is neccesary to install any extension", async () => {
    driver = await DriverBuilder.getInstance(false);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const metaDiv = await sidebar.isMetamaskExtensionNotFoundDisplayed();
    const polkDiv = await sidebar.isPolkExtensionNotFoundDisplayed();
    const metaBtnInstall = await sidebar.isMetamaskInstallBtnDisplayed();
    const polkBtnInstall = await sidebar.isPolkInstallBtnDisplayed();
    expect(metaDiv).toBeTruthy();
    expect(polkDiv).toBeTruthy();
    expect(metaBtnInstall).toBeTruthy();
    expect(polkBtnInstall).toBeTruthy();
  });

  it("As a User I get feedback when extensions are installed and correctly setup", async () => {
    driver = await DriverBuilder.getInstance();
    await setupAllExtensions(driver);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const metaDiv = await sidebar.isMetamaskExtensionNotFoundDisplayed();
    const polkDiv = await sidebar.isPolkExtensionNotFoundDisplayed();
    const metaBtnInstall = await sidebar.isMetamaskInstallBtnDisplayed();
    const polkBtnInstall = await sidebar.isPolkInstallBtnDisplayed();
    expect(metaDiv).toBeFalsy();
    expect(polkDiv).toBeFalsy();
    expect(metaBtnInstall).toBeFalsy();
    expect(polkBtnInstall).toBeFalsy();

    const isMetaOK = await sidebar.isMetamaskExtensionOK();
    const ispolkOK = await sidebar.isPolkadotExtensionOK();

    expect(isMetaOK).toBeTruthy();
    expect(ispolkOK).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await takeScreenshot(
      driver,
      expect.getState().currentTestName + " - " + session
    );
    await driver.quit();
    DriverBuilder.destroy();
    const api = getApi();
    const isConnected = await api.isConnected;
    if (isConnected){
      await api.disconnect();
    }
  });
});
