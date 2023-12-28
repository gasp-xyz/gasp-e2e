/*
 *
 * @group uiMain
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  acceptPermissionsPolkadotExtension,
  addExtraLogs,
  setupPolkadotExtension,
} from "../../utils/frontend/utils/Helper";

import { FIVE_MIN } from "../../utils/Constants";
import { WalletConnectModal } from "../../utils/frontend/pages/WalletConnectModal";

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

  it("User is informed about required extensions", async () => {
    driver = await DriverBuilder.getInstance(false);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await sidebar.clickOnWalletConnect();
    const walletConnectModal = new WalletConnectModal(driver);
    const isWalletConnectModalDisplayed = await walletConnectModal.opens();
    expect(isWalletConnectModalDisplayed).toBeTruthy();
    await walletConnectModal.pickWallet("Polkadot");
    const isReqExtensionInfoDisplayed =
      await walletConnectModal.isReqExtensionInfoDisplayed("Polkadot");
    expect(isReqExtensionInfoDisplayed).toBeTruthy();
  });

  it("User can connect polkadot.js extension with accounts", async () => {
    driver = await DriverBuilder.getInstance();
    await setupPolkadotExtension(driver);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await sidebar.clickOnWalletConnect();
    const walletConnectModal = new WalletConnectModal(driver);
    const isWalletConnectModalDisplayed = await walletConnectModal.opens();
    expect(isWalletConnectModalDisplayed).toBeTruthy();
    await walletConnectModal.pickWallet("Polkadot");
    await acceptPermissionsPolkadotExtension(driver);
    await mga.go();
    await sidebar.clickOnWalletConnect();
    await walletConnectModal.pickWallet("Polkadot");
    await walletConnectModal.pickAccount("acc_automation");
    await sidebar.waitForLoad();
    await sidebar.waitForWalletConnected();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();
    const areSidebarElementsVisible = await sidebar.areSidebarElementsVisible();
    expect(areSidebarElementsVisible).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
    await driver.quit();
    DriverBuilder.destroy();
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
  });
});
