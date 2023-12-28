import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  waitForElement,
} from "../utils/Helper";

const DIV_MAIN_APP = "app-layout";
const NAV_LIQ_POOLS = "nav-pools";
const NAV_SWAP = "nav-swap";
const NAV_TOKENS = "nav-tokens";
const NAV_STAKING = "nav-staking";
const NAV_POSITIONS = "nav-positions";

export class Sidebar {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isAppDisplayed() {
    const mainApp = buildDataTestIdXpath(DIV_MAIN_APP);
    const displayed = await this.isDisplayed(mainApp);
    return displayed;
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

  async clickNavItem(itemName: string) {
    const itemXpath = buildDataTestIdXpath(itemName);
    await clickElement(this.driver, itemXpath);
  }

  async clickNavLiqPools() {
    await this.clickNavItem(NAV_LIQ_POOLS);
  }

  async clickNavSwap() {
    await this.clickNavItem(NAV_SWAP);
  }

  async clickNavTokens() {
    await this.clickNavItem(NAV_TOKENS);
  }

  async clickNavStaking() {
    await this.clickNavItem(NAV_STAKING);
  }

  async clickNavPositions() {
    await this.clickNavItem(NAV_POSITIONS);
  }
}
