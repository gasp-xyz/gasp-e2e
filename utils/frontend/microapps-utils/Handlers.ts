import { WebDriver } from "selenium-webdriver";
import { Main } from "../microapps-pages/Main";
import { WalletConnectModal } from "../microapps-pages/WalletConnectModal";
import { WalletWrapper } from "../microapps-pages/WalletWrapper";
import { acceptPermissionsWalletExtensionInNewWindow } from "../utils/Helper";

export async function connectWallet(
  driver: WebDriver,
  walletType: string,
  acc_name: string
) {
  const walletWrapper = new WalletWrapper(driver);
  const isWalletButton = await walletWrapper.isWalletConnectButtonDisplayed();
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
}

export async function setupPage(driver: WebDriver) {
  const mainPage = new Main(driver);
  await mainPage.go();
  const appLoaded = await mainPage.isAppLoaded();
  expect(appLoaded).toBeTruthy();
  await mainPage.skipBetaInfo();
}

export async function setupPageWithState(driver: WebDriver, acc_name: string) {
  const mainPage = new Main(driver);
  await mainPage.go();
  const appLoaded = await mainPage.isAppLoaded();
  expect(appLoaded).toBeTruthy();
  await mainPage.skipBetaInfo();

  const walletWrapper = new WalletWrapper(driver);
  const isAccInfoDisplayed = await walletWrapper.isAccInfoDisplayed(acc_name);
  expect(isAccInfoDisplayed).toBeTruthy();
}
