import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildXpathByText,
  clickElement,
  isElementWithinParent,
  waitForElement,
} from "../utils/Helper";

const DIV_MAIN_APP = "app-layout";
const DIV_WALLET_WRAPPER = "wallet-wrapper";
const DIV_WALLET_CONNECTED = "wallet-connected";
//const DIV_WALLET_NOT_CONNECTED = "wallet-notConnected";
const DIV_WALLET_CONTENT = "wallet-wrapper-content";
const BUTTON_WALLET_CONNECT = "wallet-notConnected-cta";

export class Main {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isAppDisplayed() {
    const mainApp = buildDataTestIdXpath(DIV_MAIN_APP);
    const displayed = await this.isDisplayed(mainApp);
    return displayed;
  }

  async isWalletConnectButtonDisplayed() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    const displayed = await this.isDisplayed(walletWrapper);
    return displayed;
  }

  async openWalletConnectionInfo() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    await clickElement(this.driver, walletWrapper);
  }

  async isWalletConnected() {
    const walletWrapper = buildDataTestIdXpath(DIV_WALLET_WRAPPER);
    const walletConnectedContent = buildDataTestIdXpath(DIV_WALLET_CONNECTED);
    await waitForElement(
      this.driver,
      buildDataTestIdXpath(DIV_WALLET_CONTENT),
      2000
    );
    const isConnected = await isElementWithinParent(
      this.driver,
      By.xpath(walletWrapper),
      By.xpath(walletConnectedContent)
    );
    return isConnected;
  }

  async clickWalletConnect() {
    const walletWrapper = buildDataTestIdXpath(BUTTON_WALLET_CONNECT);
    await clickElement(this.driver, walletWrapper);
  }

  async pickWallet(wallet: string) {
    const walletButtonXpath = await buildXpathByText(wallet);
    await clickElement(this.driver, walletButtonXpath);
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
