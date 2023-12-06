import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
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

  async getCollatorInfo(collatorType: string) {
    const collatorListXpath =
      buildDataTestIdXpath(collatorType + "-collators-list") +
      buildDataTestIdXpath("collator-row-item");
    const addressXpath =
      collatorListXpath + buildDataTestIdXpath("collator-address");
    const totalStakeXpath =
      collatorListXpath + buildDataTestIdXpath("total-stake");
    const minBondXpath = collatorListXpath + buildDataTestIdXpath("min-bond");
    const collatorAddress = await this.driver.findElement(
      By.xpath(addressXpath),
    );
    const collatorAddressText = await collatorAddress.getText();
    if (collatorType === "active") {
      const totalStake = await this.driver.findElement(
        By.xpath(totalStakeXpath),
      );
      const totalStakeText = await totalStake.getText();
      const minBond = await this.driver.findElement(By.xpath(minBondXpath));
      const minBondText = await minBond.getText();
      const minBondValue = toNumber(minBondText);

      return {
        collatorAddress: collatorAddressText,
        totalStake: totalStakeText,
        minBond: minBondValue,
      };
    } else {
      return {
        collatorAddress: collatorAddressText,
      };
    }
  }

  async chooseCollatorRow() {
    const collatorRowXpath =
      buildDataTestIdXpath("active-collators-list") +
      buildDataTestIdXpath("collator-row-item") +
      buildDataTestIdXpath("collator-address");
    await clickElement(this.driver, collatorRowXpath);
  }

  async isCollatorsDetailCardDisplayed() {
    const itemXpath = buildDataTestIdXpath("collator-detail-card");
    return isDisplayed(this.driver, itemXpath);
  }
}
