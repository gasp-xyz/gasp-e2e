import { WebDriver } from "selenium-webdriver";
import { buildDataTestIdXpath, clickElement, isDisplayed } from "../utils/Helper";

const SEARCH_CONTAINER = "pool-list-search-container";

export class LiqPools {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isDisplayed() {
    const search = buildDataTestIdXpath(SEARCH_CONTAINER);
    const displayed = await isDisplayed(this.driver, search);
    return displayed;
  }

  async isPoolItemDisplayed(pool: string) {
    const itemXpath = buildDataTestIdXpath('pool-item' + pool);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async clickPoolItem(pool: string) {
    const itemXpath = buildDataTestIdXpath('pool-item' + pool);
    await clickElement(this.driver, itemXpath);
  }

}
