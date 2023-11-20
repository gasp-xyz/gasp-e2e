import { By, WebDriver } from "selenium-webdriver";
import { buildClassXpath, buildHrefXpath, clickElement } from "../utils/Helper";

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
}
