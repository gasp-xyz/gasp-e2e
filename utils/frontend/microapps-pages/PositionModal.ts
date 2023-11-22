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
    await waitForElementVisible(this.driver, rewardsLocator, 10000);
  }

  async removeLiquidity() {
    const removeButtonXpath = buildDataTestIdXpath("remove-button");
    await clickElement(this.driver, removeButtonXpath);
    const removeAmountXpath = buildDataTestIdXpath("removedLiq-percent-input");
    const removeAmountValue = await this.driver.findElement(
      By.xpath(removeAmountXpath),
    );
    await removeAmountValue.clear();
    await removeAmountValue.sendKeys("28");
    await removeAmountValue.clear();
    await removeAmountValue.sendKeys(28);
    await removeAmountValue.clear();
    await removeAmountValue.sendKeys(0.5);
  }
}
