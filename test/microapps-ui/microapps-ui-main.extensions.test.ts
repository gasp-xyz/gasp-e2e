/*
 *
 * @group microappsUI
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  acceptPermissionsWalletExtensionInNewWindow,
  addExtraLogs,
  setupWalletExtension,
} from "../../utils/frontend/utils/Helper";
import { FIVE_MIN } from "../../utils/Constants";
import { Main } from "../../utils/frontend/microapps-pages/Main";
import { setupUsers } from "../../utils/setup";
import { WalletConnectModal } from "../../utils/frontend/microapps-pages/WalletConnectModal";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
const acc_name = "acc_automation";

describe("Wallets management", () => {
  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    driver = await DriverBuilder.getInstance();
    setupUsers();
  });

  it.each(["Talisman", "Polkadot"])(
    "User can connect wallet %s",
    async (walletType) => {
      await setupWalletExtension(driver, walletType);
      const mainPage = new Main(driver);
      await mainPage.go();
      const walletWrapper = new WalletWrapper(driver);
      const appLoaded = await mainPage.isAppLoaded();
      expect(appLoaded).toBeTruthy();
      await mainPage.skipBetaInfo();

      const isWalletButton =
        await walletWrapper.isWalletConnectButtonDisplayed();
      expect(isWalletButton).toBeTruthy();

      await walletWrapper.openWalletConnectionInfo();
      let isWalletConnected = await walletWrapper.isWalletConnected();
      expect(isWalletConnected).toBeFalsy();

      await walletWrapper.clickWalletConnect();
      await walletWrapper.pickWallet(walletType);

      const walletConnectModal = new WalletConnectModal(driver);
      let isWalletConnectModalDisplayed = await walletConnectModal.displayed();
      expect(isWalletConnectModalDisplayed).toBeTruthy();

      await acceptPermissionsWalletExtensionInNewWindow(driver, walletType);

      const areAccountsDisplayed = await walletConnectModal.accountsDisplayed();
      expect(areAccountsDisplayed).toBeTruthy();

      await walletConnectModal.pickAccount(acc_name);
      isWalletConnectModalDisplayed = await walletConnectModal.displayed();
      expect(isWalletConnectModalDisplayed).toBeFalsy();

      isWalletConnected = await walletWrapper.isWalletConnected();
      expect(isWalletConnected).toBeTruthy();

      const isSuccessToastDisplayed =
        await mainPage.isToastDisplayed("Wallet Connected");
      expect(isSuccessToastDisplayed).toBeTruthy();

      const isAccInfoDisplayed =
        await walletWrapper.isAccInfoDisplayed(acc_name);
      expect(isAccInfoDisplayed).toBeTruthy();
    },
  );

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
    await driver.manage().deleteAllCookies();
    await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
  });

  afterAll(async () => {
    await driver.quit();
    DriverBuilder.destroy();
    const api = getApi();
    await api.disconnect();
  });
});
