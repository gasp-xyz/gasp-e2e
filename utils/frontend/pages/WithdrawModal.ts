import { WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import {
  areDisplayed,
  buildDataTestIdXpath,
  clickElement,
  getText,
  isDisplayed,
  selectAssetFromModalList,
  waitForElementVisible,
  writeText,
} from "../utils/Helper";
import { Polkadot } from "./Polkadot";

//SELECTORS
const DIV_WRAPPER = "withdrawModal-step0";
const SELECT_TOKEN = "withdrawModal-step0-tokenInput";
const STEP_O_CONT = "withdrawModal-step0-continueBtn";
const STEP_1_CONF = "withdrawModal-step1-confirmBtn";
const BACK_BTN =
  "//div[@data-testId='withdrawModal-step0-title'  and //*[@class='Icon']]/button";

export class WithdrawModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  private btnSelectTokenLocator =
    buildDataTestIdXpath(SELECT_TOKEN) + "//button";
  private inputTokenLocator = buildDataTestIdXpath(SELECT_TOKEN) + "//input";

  async isModalVisible() {
    const wrapper = buildDataTestIdXpath(DIV_WRAPPER);
    return isDisplayed(this.driver, wrapper);
  }

  async openTokensList() {
    await clickElement(this.driver, this.btnSelectTokenLocator);
  }

  async getTokenAmount(assetName: string) {
    const assetTestId = `token-list-token-${assetName}-balance`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    return parseInt(await getText(this.driver, assetLocator));
  }

  async areTokenListElementsVisible(assetName: string) {
    await sleep(2000);
    const assetTestId = `TokensModal-token-${assetName}`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    await waitForElementVisible(this.driver, assetLocator);
    const assetAmountTestId = `token-list-token-${assetName}-balance`;
    const assetAmountLocator = buildDataTestIdXpath(assetAmountTestId);
    await waitForElementVisible(this.driver, assetAmountLocator, 60000);
    const elementsDisplayed = await areDisplayed(this.driver, [
      assetLocator,
      assetAmountLocator,
    ]);
    return elementsDisplayed;
  }

  async selectToken(assetName: string) {
    await clickElement(this.driver, this.btnSelectTokenLocator);
    await selectAssetFromModalList(assetName, this.driver);
  }
  async enterValue(amount: string) {
    await clickElement(this.driver, this.inputTokenLocator);
    await writeText(this.driver, this.inputTokenLocator, amount);
  }
  async selectMax() {
    await clickElement(this.driver, `//*[text()='Max']`);
  }
  async clickContinue() {
    const xpath = buildDataTestIdXpath(STEP_O_CONT);
    await clickElement(this.driver, xpath);
  }
  async confirmAndSign() {
    const xpath = buildDataTestIdXpath(STEP_1_CONF);
    await clickElement(this.driver, xpath);
    await Polkadot.signTransaction(this.driver);
  }
  async getBalanceAssetAmount() {
    const xpathGetLocator =
      buildDataTestIdXpath(SELECT_TOKEN) +
      "//*[@class='TradingInput__right__label']";
    const text = await getText(this.driver, xpathGetLocator);
    return text.split(":")[1].trim().replace("MAX", "");
  }
  async clickBack() {
    await clickElement(this.driver, BACK_BTN);
  }
}
