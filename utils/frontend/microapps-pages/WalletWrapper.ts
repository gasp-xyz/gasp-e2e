import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildXpathByText,
  clickElement,
  elementExists,
  waitForElement,
} from "../utils/Helper";

const DIV_WALLET_WRAPPER = "wallet-wrapper";
const DIV_WALLET_CONNECTED = "wallet-connected";
const DIV_WALLET_ITEM = "wallet-selectWallet-wallet-item";
const DIV_WALLET_WRAPPER_HEADER_ACC = "wallet-wrapper-header-account";
const BUTTON_WALLET_CONNECT = "wallet-notConnected-cta";

export class WalletWrapper {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isWalletConnectButtonDisplayed() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    const displayed = await this.isDisplayed(walletWrapper);
    return displayed;
  }

  async isAccInfoDisplayed(accName: string) {
    const walletWrapperHeaderAcc =
      buildDataTestIdXpath(DIV_WALLET_WRAPPER_HEADER_ACC) +
      buildXpathByText(accName);
    const displayed = await this.isDisplayed(walletWrapperHeaderAcc);
    return displayed;
  }

  async openWalletConnectionInfo() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    await clickElement(this.driver, walletWrapper);
  }

  async isWalletConnected() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    const walletConnectedContent = buildDataTestIdXpath(DIV_WALLET_CONNECTED);
    const isConnected = await elementExists(
      this.driver,
      walletWrapper + walletConnectedContent
    );
    return isConnected;
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

  private async isDisplayed(elementXpath: string) {
    try {
      await waitForElement(this.driver, elementXpath, 2000);
      const displayed = await (
        await this.driver.findElement(By.xpath(elementXpath))
      ).isDisplayed();
      return displayed;
    } catch (Error) {
      return false;
    }
  }
}
