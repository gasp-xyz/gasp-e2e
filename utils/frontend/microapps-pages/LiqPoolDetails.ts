import { WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  buildDataTestIdXpath,
  buildXpathByText,
  isDisplayed,
  scrollIntoView,
  waitForElement,
} from "../utils/Helper";

const DIV_HEADER = "header";
const DIV_POSITION_DETAILS = "position-details";
const DIV_POOL_HISTORY = "pool-liq-history";
const DIV_POOL_STATS = "pool-statistics";
const DIV_POOL_TVL = "tvl";
const DIV_POOL_VOLUME = "volume";
const DIV_POOL_REWARDS = "monthly-rewards";

export class LiqPoolDetils {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isDisplayed(pool: string) {
    const poolHeader =
      buildDataTestIdXpath(DIV_HEADER) + buildXpathByText(pool);
    const displayed = await isDisplayed(this.driver, poolHeader);
    return displayed;
  }

  async arePositionDetialsDisplayed() {
    const itemXpath = buildDataTestIdXpath(DIV_POSITION_DETAILS);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isPoolHistoryDisplayed() {
    const itemXpath = buildDataTestIdXpath(DIV_POOL_HISTORY);
    await scrollIntoView(this.driver, itemXpath);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async arePoolStatsDisplayed() {
    const poolStats = buildDataTestIdXpath(DIV_POOL_STATS);
    await waitForElement(this.driver, poolStats);

    const tvl = poolStats + buildDataTestIdXpath(DIV_POOL_TVL);
    const volume = poolStats + buildDataTestIdXpath(DIV_POOL_VOLUME);
    const rewards = poolStats + buildDataTestIdXpath(DIV_POOL_REWARDS);

    const displayed = await areDisplayed(this.driver, [
      tvl,
      volume,
      rewards,
      poolStats,
    ]);
    return displayed;
  }
}
