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
  openInNewTab,
  swithToTheOtherTab,
} from "../../utils/frontend/utils/Helper";

import { FIVE_MIN } from "../../utils/Constants";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";

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

  it("As a User I can switch between polkadot wallets", async () => {
    driver = await DriverBuilder.getInstance();
    const polkUserAddress = await (
      await setupAllExtensions(driver)
    ).polkUserAddress;
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isMetaOK = await sidebar.isMetamaskExtensionOK();
    let ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(isMetaOK).toBeTruthy();
    expect(ispolkOK).toBeTruthy();

    const extensionManager = new Polkadot(driver);
    await openInNewTab(driver, extensionManager.WEB_UI_ACCESS_URL);
    const [polkUserAddress2] = await extensionManager.createAccount(1);
    await swithToTheOtherTab(driver);
    let userSelected = await sidebar.getUserName();
    expect(userSelected).toEqual("acc_automation");
    ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(ispolkOK).toBeTruthy();

    await swithToTheOtherTab(driver);
    await extensionManager.hideAccount(polkUserAddress);
    await swithToTheOtherTab(driver);
    userSelected = await sidebar.getUserName();
    expect(userSelected).toEqual("acc_automation_1");
    ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(ispolkOK).toBeTruthy();

    await swithToTheOtherTab(driver);
    await extensionManager.hideAccount(polkUserAddress2);
    await swithToTheOtherTab(driver);

    ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(ispolkOK).toBeFalsy();
  });
  it("As a User I can switch between polkadot wallets using the modal", async () => {
    driver = await DriverBuilder.getInstance();
    await (
      await setupAllExtensions(driver)
    ).polkUserAddress;
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isMetaOK = await sidebar.isMetamaskExtensionOK();
    let ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(isMetaOK).toBeTruthy();
    expect(ispolkOK).toBeTruthy();

    const extensionManager = new Polkadot(driver);
    await openInNewTab(driver, extensionManager.WEB_UI_ACCESS_URL);
    const [polkUserAddress2] = await extensionManager.createAccount(1);
    await swithToTheOtherTab(driver);
    let userSelected = await sidebar.getUserName();
    expect(userSelected).toEqual("acc_automation");
    ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(ispolkOK).toBeTruthy();

    await sidebar.switchAccountTo(polkUserAddress2);
    userSelected = await sidebar.getUserName();
    expect(userSelected).toEqual("acc_automation_1");
    ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(ispolkOK).toBeTruthy();
  });
  it("As a User I can not see hidden wallets in the modal", async () => {
    driver = await DriverBuilder.getInstance();
    const firstUserAddress = await (
      await setupAllExtensions(driver)
    ).polkUserAddress;
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isMetaOK = await sidebar.isMetamaskExtensionOK();
    let ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(isMetaOK).toBeTruthy();
    expect(ispolkOK).toBeTruthy();
    const accountsBefore = await sidebar.getAvailableAccountsFromChangeModal();
    expect(accountsBefore).toEqual([firstUserAddress]);

    const extensionManager = new Polkadot(driver);
    await openInNewTab(driver, extensionManager.WEB_UI_ACCESS_URL);
    const [secondUserAddress] = await extensionManager.createAccount(1);
    await extensionManager.hideAccount(firstUserAddress);
    await extensionManager.hideAccount(secondUserAddress);
    await swithToTheOtherTab(driver);
    ispolkOK = await sidebar.isPolkadotExtensionOK();
    expect(ispolkOK).toBeFalsy();

    const accounts = await sidebar.getAvailableAccountsFromChangeModal();
    expect(accounts.length).toEqual(0);
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
