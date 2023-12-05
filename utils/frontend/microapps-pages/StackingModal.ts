import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  isDisplayed,
  waitForElementVisible,
} from "../utils/Helper";
import toNumber from "lodash-es/toNumber";

export class StackingModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isCollatorsListDisplayed() {
    const itemXpath = buildDataTestIdXpath("active-collators-list");
    return isDisplayed(this.driver, itemXpath);
  }

  async waitForCollatorsVisible() {
    const collatorListLocator = buildDataTestIdXpath("collator-row-item");
    await waitForElementVisible(this.driver, collatorListLocator, 8000);
  }

  async getCollatorInfo() {
    const collatorRowXpath = buildDataTestIdXpath("collator-row-item");
    const addressXpath = buildDataTestIdXpath("collator-address");
    const totalStakeXpath = buildDataTestIdXpath("total-stake");
    const minBondXpath = buildDataTestIdXpath("min-bond");
    const collatorAddress = await this.driver
      .findElement(By.xpath(collatorRowXpath))
      .findElement(By.xpath(addressXpath));
    const collatorAddressText = await collatorAddress.getText();
    const totalStake = await this.driver
      .findElement(By.xpath(collatorRowXpath))
      .findElement(By.xpath(totalStakeXpath));
    const totalStakeText = await totalStake.getText();
    const minBond = await this.driver
      .findElement(By.xpath(collatorRowXpath))
      .findElement(By.xpath(minBondXpath));
    const minBondText = await minBond.getText();
    const minBondValue = toNumber(minBondText);
    return {
      collatorAddress: collatorAddressText,
      totalStake: totalStakeText,
      minBond: minBondValue,
    };
  }
}
