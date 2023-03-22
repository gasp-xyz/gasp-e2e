/*
 *
 * @group microappsUI
 */
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  acceptPermissionsPolkadotExtensionInNewWindow,
  addExtraLogs,
  setupPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { Keyring } from "@polkadot/api";
import { FIVE_MIN } from "../../utils/Constants";
import { Main } from "../../utils/frontend/microapps-pages/Main";
import { User } from "../../utils/User";
import { setupUsers } from "../../utils/setup";
import { WalletConnectModal } from "../../utils/frontend/microapps-pages/WalletConnectModal";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;
const acc_name = "acc_automation";

describe("Wallets management", () => {
  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    driver = await DriverBuilder.getInstance();
    const keyring = new Keyring({ type: "sr25519" });
    setupUsers();
    const { mnemonic } = await setupPolkadotExtension(driver);
    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
  });

  it("User can connect Polkadot wallet", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    const walletWrapper = new WalletWrapper(driver);
    const mainPage = new Main(driver);
    const appLoaded = await mainPage.isAppLoaded();
    expect(appLoaded).toBeTruthy();

    const isWalletButton = await walletWrapper.isWalletConnectButtonDisplayed();
    expect(isWalletButton).toBeTruthy();

    await walletWrapper.openWalletConnectionInfo();
    let isWalletConnected = await walletWrapper.isWalletConnected();
    expect(isWalletConnected).toBeFalsy();

    await walletWrapper.clickWalletConnect();
    await walletWrapper.pickWallet("Polkadot");

    const walletConnectModal = new WalletConnectModal(driver);
    let isWalletConnectModalDisplayed = await walletConnectModal.displayed();
    expect(isWalletConnectModalDisplayed).toBeTruthy();
    await acceptPermissionsPolkadotExtensionInNewWindow(driver);

    const areAccountsDisplayed = await walletConnectModal.accountsDisplayed();
    expect(areAccountsDisplayed).toBeTruthy();

    await walletConnectModal.pickAccount(acc_name);
    isWalletConnectModalDisplayed = await walletConnectModal.displayed();
    expect(isWalletConnectModalDisplayed).toBeFalsy();

    isWalletConnected = await walletWrapper.isWalletConnected();
    expect(isWalletConnected).toBeTruthy();

    const isSuccessToastDisplayed = await mainPage.isToastDisplayed(
      "Wallet Connected"
    );
    expect(isSuccessToastDisplayed).toBeTruthy();

    const isAccInfoDisplayed = await walletWrapper.isAccInfoDisplayed(acc_name);
    expect(isAccInfoDisplayed).toBeTruthy();
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

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
  });
});
