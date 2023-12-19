import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildXpathByText,
  clickElement,
  isDisplayed,
  waitForElementVisible,
} from "../utils/Helper";
import toNumber from "lodash-es/toNumber";

export class StakingPageDriver {
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
      const minBondNumber = minBondText.replace(",", "");
      const minBondValue = toNumber(minBondNumber);

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

  async chooseCollatorRow(index = 0) {
    const collatorRowXpath =
      buildDataTestIdXpath("active-collators-list") +
      buildDataTestIdXpath("collator-row-item") +
      buildDataTestIdXpath("collator-address");
    const collatorAddresses = await this.driver.findElements(
      By.xpath(collatorRowXpath),
    );
    const collatorAddress = await collatorAddresses[index].getText();
    const collatorAddressValueXpath =
      buildDataTestIdXpath("active-collators-list") +
      buildDataTestIdXpath("collator-row-item") +
      buildXpathByText(collatorAddress);
    await clickElement(this.driver, collatorAddressValueXpath);
  }

  async isCollatorsDetailCardDisplayed() {
    const itemXpath = buildDataTestIdXpath("collator-detail-card");
    return isDisplayed(this.driver, itemXpath);
  }

  async startStaking() {
    const startStakingButton = buildDataTestIdXpath(
      "stake-widget-banner-new-cta",
    );
    await clickElement(this.driver, startStakingButton);
  }

  async setStakingValue(value: any) {
    const stakingValueXpath = buildDataTestIdXpath(
      "new-stake-widget-tokenInput-input",
    );
    const tokenInput = await this.driver.findElement(
      By.xpath(stakingValueXpath),
    );
    await tokenInput.sendKeys(value);
  }

  async waitForStakingFeeVisible() {
    const collatorListLocator = buildDataTestIdXpath(
      "new-stake-widget-details-fee-value",
    );
    await waitForElementVisible(this.driver, collatorListLocator, 10000);
  }

  async submitStaking() {
    const startStakingButton = buildDataTestIdXpath("new-stake-widget-submit");
    await clickElement(this.driver, startStakingButton);
  }

  async waitStartStakingButtonVisible() {
    const collatorListLocator = buildDataTestIdXpath(
      "stake-widget-banner-new-cta",
    );
    await waitForElementVisible(this.driver, collatorListLocator, 4000);
  }

  async isStartStakingButtonDisplayed() {
    const itemXpath = buildDataTestIdXpath("stake-widget-banner-new-cta");
    return isDisplayed(this.driver, itemXpath);
  }

  async goToPositionInfo() {
    const positionInfoButton = buildDataTestIdXpath(
      "stake-widget-banner-manage-position",
    );
    await clickElement(this.driver, positionInfoButton);
  }

  async getStakingButtonText() {
    const startStakingButtonXpath = buildDataTestIdXpath(
      "new-stake-widget-submit",
    );
    const startStakingButton = await this.driver.findElement(
      By.xpath(startStakingButtonXpath),
    );
    const startStakingButtonText = await startStakingButton.getText();
    return startStakingButtonText;
  }
}
