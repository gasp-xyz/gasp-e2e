import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildHrefXpath,
  clickElement,
  waitForElementVisible,
} from "../utils/Helper";

export class PositionModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isLiqPoolDisplayed(firstTokenName: string, secondTokenName: string) {
    const PoolName = "pool-" + firstTokenName + "-" + secondTokenName;
    const itemXpath = buildDataTestIdXpath(PoolName);
    const myPoolPosition = await this.driver.findElement(By.xpath(itemXpath));
    return myPoolPosition;
  }

  async clickPromPoolPosition(firstTokenName: string, secondTokenName: string) {
    const PoolName = "/positions/" + firstTokenName + "-" + secondTokenName;
    const hrefXpath = buildHrefXpath(PoolName);
    await clickElement(this.driver, hrefXpath);
  }

  async waitForPoolPositionsVisible() {
    const rewardsLocator = buildDataTestIdXpath("user-rewards-panel");
    await waitForElementVisible(this.driver, rewardsLocator, 8000);
  }

  async setupRemovableLiquidity() {
    const removeButtonXpath = buildDataTestIdXpath("remove-button");
    await clickElement(this.driver, removeButtonXpath);
    const removeAmountXpath = buildDataTestIdXpath("50%-button");
    await clickElement(this.driver, removeAmountXpath);
    const feeValueXpath = buildDataTestIdXpath("removing-fee-value");
    await waitForElementVisible(this.driver, feeValueXpath, 12000);
  }

  async clickRemoveLiquidity() {
    const submitSwapXpath = buildDataTestIdXpath("submitSwap");
    await clickElement(this.driver, submitSwapXpath);
  }
}
