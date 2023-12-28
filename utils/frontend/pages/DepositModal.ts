import { By, until, WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import {
  areDisplayed,
  buildDataTestIdXpath,
  clickElement,
  getText,
  isDisplayed,
  waitForElement,
  waitForElementState,
  waitForLoad,
  writeText,
} from "../utils/Helper";
import { MetaMask } from "./MetaMask";

//SELECTORS
const DIV_TITLE = "depositModal-step0-title";
const SELECT_TOKEN = "depositModal-step0-tokenInput";
const STEP_O_CONT = "depositModal-step0-continueBtn";
const STEP_1_CONF = "depositModal-step1-confirmBtn";

export class DepositModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  private btnSelectTokenLocator =
    buildDataTestIdXpath(SELECT_TOKEN) + "//button";
  private inputTokenLocator = buildDataTestIdXpath(SELECT_TOKEN) + "//input";

  async isModalVisible() {
    const title = buildDataTestIdXpath(DIV_TITLE);
    return isDisplayed(this.driver, title);
  }

  async openTokensList() {
    await clickElement(this.driver, this.btnSelectTokenLocator);
  }

  async selectToken(assetName: string) {
    const assetTestId = `TokensModal-token-${assetName}`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    await sleep(2000);
    const element = await this.driver.wait(
      until.elementLocated(By.xpath(assetLocator)),
    );
    await this.driver.wait(until.elementIsVisible(element));
    await this.driver.wait(until.elementIsEnabled(element));
    await element.click();
  }

  async getTokenAmount(assetName: string) {
    const assetTestId = `token-list-token-${assetName}-balance`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    return parseFloat(await getText(this.driver, assetLocator));
  }

  async areTokenListElementsVisible(
    assetName: string,
    retries = 10,
  ): Promise<boolean> {
    try {
      const assetTestId = `TokensModal-token-${assetName}`;
      const assetLocator = buildDataTestIdXpath(assetTestId);
      const element = await this.driver.wait(
        until.elementLocated(By.xpath(assetLocator)),
        10000,
      );
      await this.driver.wait(until.elementIsVisible(element));
      await this.driver.wait(until.elementIsEnabled(element));
      const assetAmountTestId = `token-list-token-${assetName}-balance`;
      const assetAmountLocator =
        assetLocator + buildDataTestIdXpath(assetAmountTestId);
      await waitForElement(this.driver, assetAmountLocator, 60000);
      return await areDisplayed(this.driver, [
        assetLocator,
        assetAmountLocator,
      ]);
    } catch (error) {
      if (retries > 0) {
        await sleep(3000);
        return await this.areTokenListElementsVisible(assetName, retries - 1);
      } else {
        return false;
      }
    }
  }

  async enterValue(amount: string) {
    await clickElement(this.driver, this.inputTokenLocator);
    await writeText(this.driver, this.inputTokenLocator, amount);
  }
  async waitForProgressBar() {
    const continueBtn = buildDataTestIdXpath(STEP_O_CONT);
    const progressBarXpath = "//*[@role='progressbar']";
    await waitForLoad(5, continueBtn + progressBarXpath, this.driver);
  }
  async clickContinue() {
    const xpath = buildDataTestIdXpath(STEP_O_CONT);
    await clickElement(this.driver, xpath);
  }

  async waitForContinueState(isEnabled: boolean) {
    const xpath = buildDataTestIdXpath(STEP_O_CONT);
    await waitForElementState(this.driver, xpath, isEnabled);
  }

  async isContinueButtonEnabled() {
    const xpath = buildDataTestIdXpath(STEP_O_CONT);
    return await (await this.driver.findElement(By.xpath(xpath))).isEnabled();
  }

  async confirmAndSign() {
    const xpath = buildDataTestIdXpath(STEP_1_CONF);
    await clickElement(this.driver, xpath);
    const meta = new MetaMask(this.driver);
    await meta.confirmTransaction();
  }
}
