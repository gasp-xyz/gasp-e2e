import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildXpathByText,
  elementExists,
  isDisplayed,
} from "../utils/Helper";

const DIV_MAIN_APP = "app-layout";
const GENERIC_TOAST = "toast";

export class Main {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isAppLoaded() {
    const mainApp = buildDataTestIdXpath(DIV_MAIN_APP);
    const displayed = await isDisplayed(this.driver, mainApp);
    return displayed;
  }

  async isToastDisplayed(text: string) {
    const toast = buildDataTestIdXpath(GENERIC_TOAST);
    const message = buildXpathByText(text);
    const displayed = await elementExists(this.driver, toast + message);
    return displayed;
  }
}
