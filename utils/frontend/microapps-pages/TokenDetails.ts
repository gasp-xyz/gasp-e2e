import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  isDisplayed,
  scrollIntoView,
} from "../utils/Helper";

const TOKEN_DETAILS_PAGE = "token-details";
const BUTTON_TRADE_TOKEN = "trade-token";
const DETAILS_PRICE = "price";
const DETAILS_VOLUME = "volume";
const TOKEN_DETAILS_CHART = "token-detail-chart";

export class TokenDetails {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isDisplayed() {
    const page = buildDataTestIdXpath(TOKEN_DETAILS_PAGE);
    const displayed = await isDisplayed(this.driver, page);
    return displayed;
  }

  async clickTradeToken() {
    const itemXpath = buildDataTestIdXpath(BUTTON_TRADE_TOKEN);
    await scrollIntoView(this.driver, itemXpath);
    await clickElement(this.driver, itemXpath);
  }

  async isPoolItemDisplayed(pool: string) {
    const itemXpath = buildDataTestIdXpath("pool-item" + pool);
    await scrollIntoView(this.driver, itemXpath);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isPriceDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(TOKEN_DETAILS_PAGE) +
      buildDataTestIdXpath(DETAILS_PRICE);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isVolumeDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(TOKEN_DETAILS_PAGE) +
      buildDataTestIdXpath(DETAILS_VOLUME);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isChartDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(TOKEN_DETAILS_PAGE) +
      buildDataTestIdXpath(TOKEN_DETAILS_CHART);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async clickPoolItem(pool: string) {
    const itemXpath = buildDataTestIdXpath("pool-item" + pool);
    await scrollIntoView(this.driver, itemXpath);
    await clickElement(this.driver, itemXpath);
  }
}
