import { WebDriver } from "selenium-webdriver";
import { buildXpathByText, isDisplayed } from "../utils/Helper";

export class BalanceWarningModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async displayed() {
    const xpath = buildXpathByText("Warning! Low GASP Balance");
    return await isDisplayed(this.driver, xpath);
  }
}
