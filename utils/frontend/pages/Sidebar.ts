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

const SPINNER_LOADING = `//*[@class = 'Sidebar__loading']`;

export class Sidebar {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isConnectMetamaskVisible() {
    throw new Error("Method not implemented.");
  }

  async isMetamaskExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_META_NOT_FOUND);
    waitForElement(this.driver, notInstalledXpath);
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
    waitForElement(this.driver, elementXpath);
    const displayed = await (
      await this.driver.findElement(By.xpath(elementXpath))
    ).isDisplayed();
    return displayed;
  }
}
