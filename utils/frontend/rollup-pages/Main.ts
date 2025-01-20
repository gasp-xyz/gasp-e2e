import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import {
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByText,
  clickElement,
  elementExists,
  isDisplayed,
  waitForElementVisible,
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
    const welcomeButton = buildXpathByElementText("button", "Start trading");
    const welcomeButtonAlternate = buildXpathByElementText("button", "START TRADING");
    try {
      await waitForElementVisible(this.driver, welcomeButton, 5000);
      await clickElement(this.driver, welcomeButton);
    } catch (error) {
      //Button not found - no action performed.
    }
    try {
      await waitForElementVisible(this.driver, welcomeButtonAlternate, 5000);
      await clickElement(this.driver, welcomeButton);
    } catch (error) {
      //Button not found - no action performed.
    }
  }

  async skipLaunchMessage() {
    const betaButton = buildXpathByElementText("span", "Hide");
    try {
      await clickElement(this.driver, betaButton);
    } catch (error) {
      //Button not found - no action performed.
    }
  }

  async skipMailerIframe() {
    const iframeXpath = "//Iframe";
    try {
      await waitForElementVisible(this.driver, iframeXpath, 10000);
    } catch (error) {
      //no popup
    }
    const isIframeDisplayed = await isDisplayed(this.driver, iframeXpath);
    if (isIframeDisplayed) {
      this.driver.switchTo().frame(0);
      await clickElement(this.driver, "//button[@aria-label='Close']");
      const handle = await this.driver.getAllWindowHandles();
      const iterator = handle.entries();
      const value = iterator.next().value;
      await this.driver.switchTo().window(value[1]);
    }
  }
}
