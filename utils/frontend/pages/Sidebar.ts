import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  waitForElement,
  waitForElementToDissapear,
} from "../utils/Helper";

const DIV_META_NOT_FOUND = "extensionMetamask-extensionNotFound";
const DIV_POLK_NOT_FOUND = "extensionPolkadot-extensionNotFound";
const BTN_INSTALL_META = "extensionMetamask-extensionNotFound-installBtn";
const BTN_INSTALL_POLK = "extensionPolkadot-extensionNotFound-installBtn";

const DOT_META_OK = "connect-metamaskGreenDot";
const BTN_META_DEPOSIT = "bridge-showDepositModalBtn";
const BTN_META_WITHDRAW = "bridge-showWithdrawModalBtn";

const DOT_POLK_OK = "connect-polkadotGreenDot";
const DIV_FAUCET_READY = "faucet-isReady-header";
const LBL_TOKEN_AMOUNT = "wallet-tokensAmount";

const SPINNER_LOADING = `//*[@class = 'Sidebar__loading']`;

export class Sidebar {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isConnectMetamaskVisible() {
    throw new Error("Method not implemented.");
  }
  async isPolkadotExtensionOK() {
    return await this.areVisible([
      DOT_POLK_OK,
      LBL_TOKEN_AMOUNT,
      DIV_FAUCET_READY,
    ]);
  }

  async isMetamaskExtensionOK() {
    return await this.areVisible([
      DOT_META_OK,
      BTN_META_DEPOSIT,
      BTN_META_WITHDRAW,
    ]);
  }

  private async areVisible(listDataTestIds: string[]) {
    const promises: Promise<Boolean>[] = [];
    listDataTestIds.forEach((dataTestId) => {
      promises.push(this.isDisplayed(buildDataTestIdXpath(dataTestId)));
    });
    const allVisible = await Promise.all(promises);
    return allVisible.every((elem) => elem === true);
  }

  async isMetamaskExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_META_NOT_FOUND);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }
  async isPolkExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_POLK_NOT_FOUND);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }

  async isMetamaskInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_META);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }
  async isPolkInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_POLK);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }

  async waitForLoad() {
    await waitForElementToDissapear(this.driver, SPINNER_LOADING);
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
