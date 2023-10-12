import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  isDisplayed,
  scrollIntoView,
} from "../utils/Helper";

const SEARCH_CONTAINER = "pool-list-search-container";
const TAB_PROMOTED_POOLS = "Promoted-Pools-item";
const TAB_ALL_POOLS = "All-Pools-item";

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
    const itemXpath = buildDataTestIdXpath("pool-item" + pool);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async clickPoolItem(pool: string) {
    const itemXpath = buildDataTestIdXpath("pool-item" + pool);
    await scrollIntoView(this.driver, itemXpath);
    await clickElement(this.driver, itemXpath);
  }

  async clickPromotedPoolsTab() {
    const itemXpath = buildDataTestIdXpath(TAB_PROMOTED_POOLS);
    await clickElement(this.driver, itemXpath);
  }

  async clickAllPoolsTab() {
    const itemXpath = buildDataTestIdXpath(TAB_ALL_POOLS);
    await clickElement(this.driver, itemXpath);
  }
}
