/*
 *
 * @group rollupWalletDev
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importMetamaskExtension,
} from "../../utils/frontend/utils/Helper";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/rollup-utils/Handlers";
import { WalletConnectModal } from "../../utils/frontend/rollup-pages/WalletConnectModal";
import { WalletWrapper } from "../../utils/frontend/rollup-pages/WalletWrapper";
import { sleep } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";

describe("Gasp UI wallet tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    acc_addr = await importMetamaskExtension(driver, true);
    acc_addr_short = acc_addr.slice(-4);

    await setupPage(driver);
    await connectWallet(driver, "MetaMask", acc_addr_short);
  });

  test("User can connect and disconnect Metamask wallet", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openWalletSettings();

    const walletModal = new WalletConnectModal(driver);
    const areAccountsDisplayed = await walletModal.accountsDisplayed();
    expect(areAccountsDisplayed).toBeTruthy();
    const isAccInfoDisplayed =
      await walletModal.isAccInfoDisplayed(acc_addr_short);
    expect(isAccInfoDisplayed).toBeTruthy();

    await walletModal.disconnect();
    await sleep(1000);
    const isWalletConnected = await walletWrapper.isWalletConnected();
    expect(isWalletConnected).toBeFalsy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
