import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import {
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByText,
  clickElement,
  elementExists,
  hoverElement,
  isDisplayed,
  waitForElementToDissapear,
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

    await waitForElementVisible(this.driver, welcomeButton, 3000);
    await hoverElement(this.driver, welcomeButton);
    await sleep(500);
    await clickElement(this.driver, welcomeButton);
    await waitForElementToDissapear(this.driver, welcomeButton);
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
