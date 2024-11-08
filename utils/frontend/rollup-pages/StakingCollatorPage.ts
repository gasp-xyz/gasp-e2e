import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  isDisplayed,
} from "../utils/Helper";

export class StakingCollatorPage {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isCollatorsDetailCardDisplayed() {
    const itemXpath = buildDataTestIdXpath("collator-details");
    return isDisplayed(this.driver, itemXpath);
  }

  async clickBack() {
    const itemXpath = buildDataTestIdXpath("back-button");
    return clickElement(this.driver, itemXpath);
  }
}
