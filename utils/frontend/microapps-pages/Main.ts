import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildXpathByText,
  waitForElement,
} from "../utils/Helper";

const DIV_MAIN_APP = "app-layout";
const GENERIC_TOAST = "toast";

export class Main {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isAppDisplayed() {
    const mainApp = buildDataTestIdXpath(DIV_MAIN_APP);
    const displayed = await this.isDisplayed(mainApp);
    return displayed;
  }

  async isToastDisplayed(text: string) {
    const toast = buildDataTestIdXpath(GENERIC_TOAST);
    const message = buildXpathByText(text);
    const displayed = await this.isDisplayed(toast + message);
    return displayed;
  }

  private async isDisplayed(elementXpath: string) {
    try {
      await waitForElement(this.driver, elementXpath, 2000);
      const displayed = await (
        await this.driver.findElement(By.xpath(elementXpath))
      ).isDisplayed();
      return displayed;
    } catch (Error) {
      return false;
    }
  }
}
