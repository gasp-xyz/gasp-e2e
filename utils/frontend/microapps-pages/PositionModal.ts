import { By, WebDriver } from "selenium-webdriver";
import {
  buildClassXpath,
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
    const PoolName = "/positions/" + firstTokenName + "-" + secondTokenName;
    const hrefXpath = buildHrefXpath(PoolName);
    const itemXpath = buildClassXpath("w-full mb-5");
    const myPoolPosition = await this.driver
      .findElement(By.xpath(itemXpath))
      .findElement(By.xpath(hrefXpath));
    return myPoolPosition;
  }

  async clickPromPoolPosition(firstTokenName: string, secondTokenName: string) {
    const PoolName = "/positions/" + firstTokenName + "-" + secondTokenName;
    const hrefXpath = buildHrefXpath(PoolName);
    await clickElement(this.driver, hrefXpath);
  }

  async waitForPoolPositionsVisible() {
    const rewardsLocator = buildClassXpath(
      "transition-all font-title-4 text-secondary",
    );
    await waitForElementVisible(this.driver, rewardsLocator, 10000);
  }

  async removeLiquidity() {
    const removeButtonXpath = buildClassXpath(
      "box-border flex items-center justify-center rounded-full focus:outline-none min-w-max whitespace-nowrap border uppercase hover:bg-panel border-solid border-soft font-body-m px-4 font-medium h-10",
    );
    await clickElement(this.driver, removeButtonXpath);
    const removeAmountLabelClass = buildClassXpath(
      "flex flex-row items-center justify-start min-w-[76px]",
    );
    const removeAmountValueClass = buildDataTestIdXpath("undefined-input");
    const removeAmountValue = await this.driver
      .findElement(By.xpath(removeAmountLabelClass))
      .findElement(By.xpath(removeAmountValueClass));
    await removeAmountValue.clear();
    await removeAmountValue.sendKeys("28");
    await removeAmountValue.clear();
    await removeAmountValue.sendKeys(28);
    await removeAmountValue.clear();
    await removeAmountValue.sendKeys(0.5);
  }
}
