import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import {
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByText,
  clickElement,
  elementExists,
  isDisplayed,
} from "../utils/Helper";

const DIV_MAIN_APP = "app-layout";
const GENERIC_TOAST = "toast";

export class Main {
  driver: WebDriver;
  uiUri: string;

  constructor(driver: WebDriver) {
    this.driver = driver;
    const { uiUri } = getEnvironmentRequiredVars();
    this.uiUri = uiUri;
  }

  async go() {
    await this.driver.get(this.uiUri);
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

  async skipWelcomeMessage() {
    const betaButton = buildXpathByElementText("button", "Get Started");
    try {
      await clickElement(this.driver, betaButton);
    } catch (error) {
      //Button not found - no action performed.
    }
  }
}
