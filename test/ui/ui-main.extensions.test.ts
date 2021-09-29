/*
 *
 * @group ui
 */
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  addExtraLogs,
} from "../../utils/frontend/utils/Helper";
import { FIVE_MIN } from "../../utils/Constants";

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
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
    await driver.quit();
    DriverBuilder.destroy();
  });
});

afterAll(async () => {
  const api = getApi();
  await api.disconnect();
});
