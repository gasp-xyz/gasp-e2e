import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByText,
  clickElement,
  elementExists,
  isDisplayed,
} from "../utils/Helper";

const DIV_WALLET_WRAPPER = "wallet-wrapper";
const DIV_WALLET_CONNECTED = "wallet-connected";
const DIV_WALLET_ITEM = "installedWallets-walletCard";
const DIV_WALLET_WRAPPER_HEADER_ACC = "wallet-wrapper-header-account";
const BUTTON_WALLET_CONNECT = "wallet-notConnected-cta";

export class WalletWrapper {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isWalletConnectButtonDisplayed() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    return await isDisplayed(this.driver, walletWrapper);
  }

  async isAccInfoDisplayed(accName: string) {
    const walletWrapperHeaderAcc =
      buildDataTestIdXpath(DIV_WALLET_WRAPPER_HEADER_ACC) +
      buildXpathByText(accName);
    return await isDisplayed(this.driver, walletWrapperHeaderAcc);
  }

  async openWalletConnectionInfo() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    await clickElement(this.driver, walletWrapper);
  }

  async openDeposit() {
    const betaButton = buildXpathByElementText("button", "Deposit");
    await clickElement(this.driver, betaButton);
  }

  async openWithdraw() {
    const betaButton = buildXpathByElementText("button", "Withdraw");
    await clickElement(this.driver, betaButton);
  }

  async isWalletConnected() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    const walletConnectedContent = buildDataTestIdXpath(DIV_WALLET_CONNECTED);
    return await elementExists(
      this.driver,
      walletWrapper + walletConnectedContent,
    );
  }

  async clickWalletConnect() {
    const walletWrapper = buildDataTestIdXpath(BUTTON_WALLET_CONNECT);
    await clickElement(this.driver, walletWrapper);
  }

  async pickWallet(wallet: string) {
    const walletButtonXpath = buildXpathByText(wallet);
    const walletItem = buildDataTestIdXpath(DIV_WALLET_ITEM);
    await clickElement(this.driver, walletItem + walletButtonXpath);
  }
}
