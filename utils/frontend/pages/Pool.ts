import { By, WebDriver } from "selenium-webdriver";
import { waitForNBlocks } from "../../utils";

import {
  buildDataTestIdXpath,
  clickElement,
  getText,
  isDisplayed,
  pressEscape,
  waitForElement,
  writeText,
} from "../utils/Helper";

//SELECTORS
const TAB_POOL_TEST_ID = "trading-poolTab";
const DIV_POOL_TOKEN1 = "tradingPoolTab-firstTokenInput";
const DIV_POOL_TOKEN2 = "tradingPoolTab-secondTokenInput";
const BTN_POOL_PROVIDE = "tradingPoolTab-provideBtn";
const BTN_MANAGE_TOKENS_LIST = "tokensModal-manageTokenListsBtn";

export class Pool {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  private btnToggleShowAllTokens = "//*[@for='tokenListsCheckbox-everything']";
  private btnManageTokensList = buildDataTestIdXpath(BTN_MANAGE_TOKENS_LIST);
  private btnToken1Locator = buildDataTestIdXpath(DIV_POOL_TOKEN1) + "//button";
  private btnToken2Locator = buildDataTestIdXpath(DIV_POOL_TOKEN2) + "//button";
  private inputToken1Locator =
    buildDataTestIdXpath(DIV_POOL_TOKEN1) + "//input";
  private inputToken2Locator =
    buildDataTestIdXpath(DIV_POOL_TOKEN2) + "//input";

  private btnToken1MaxLocator =
    buildDataTestIdXpath(DIV_POOL_TOKEN1) +
    "//button[span[contains(text(),'Max')]]";
  private btnToken2MaxLocator =
    buildDataTestIdXpath(DIV_POOL_TOKEN2) +
    "//button[span[contains(text(),'Max')]]";

  async togglePool() {
    const selector = buildDataTestIdXpath(TAB_POOL_TEST_ID);
    await clickElement(this.driver, selector);
  }

  async isPoolToggled() {
    const tradeBtn = buildDataTestIdXpath(BTN_POOL_PROVIDE);
    return isDisplayed(this.driver, tradeBtn);
  }
  /**
   * Select one asset to pay with.
   * @param assetName : MGA, mETH, mDOT, mBTC, mUSDC
   */
  async selectToken1Asset(assetName: string = "MGA") {
    await clickElement(this.driver, this.btnToken1Locator);
    await this.selectAssetFromModalList(assetName);
  }
  async selectToken2Asset(assetName: string) {
    await clickElement(this.driver, this.btnToken2Locator);
    await this.selectAssetFromModalList(assetName);
  }

  async provideOrCreatePool() {
    const tradeBtn = buildDataTestIdXpath(BTN_POOL_PROVIDE);
    await waitForElement(this.driver, tradeBtn);
    await waitForNBlocks(2);
    const enabled = await (
      await this.driver.findElement(By.xpath(tradeBtn))
    ).isEnabled();
    if (!enabled) {
      throw new Error("Provide btn is not enabled!");
    }
    await clickElement(this.driver, tradeBtn);
  }

  async addToken1AssetAmount(amount: string) {
    await clickElement(this.driver, this.inputToken1Locator);
    await writeText(this.driver, this.inputToken1Locator, amount);
  }
  async addToken2AssetAmount(amount: string) {
    await clickElement(this.driver, this.inputToken2Locator);
    await writeText(this.driver, this.inputToken2Locator, amount);
  }

  private async selectAssetFromModalList(assetName: string) {
    const assetTestId = `TokensModal-token-${assetName}`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    await clickElement(this.driver, assetLocator);
  }
  async getToken2Text(): Promise<string> {
    return await getText(this.driver, this.btnToken2Locator);
  }
  async getToken1Text(): Promise<string> {
    return await getText(this.driver, this.btnToken1Locator);
  }
  async clickToToken2MaxBtn() {
    await clickElement(this.driver, this.btnToken2MaxLocator);
  }
  async clickToToken1MaxBtn() {
    await clickElement(this.driver, this.btnToken1MaxLocator);
  }
  async getBalanceFromtoken2() {
    const xpathGetLocator =
      buildDataTestIdXpath(DIV_POOL_TOKEN2) +
      "//*[@class='TradingInput__right__label']";
    const text = await getText(this.driver, xpathGetLocator);
    return text.split(":")[1].trim().replace("MAX", "").trim();
  }

  async toggleShowAllTokens() {
    await clickElement(this.driver, this.btnToken1Locator);
    await clickElement(this.driver, this.btnManageTokensList);
    await clickElement(this.driver, this.btnToggleShowAllTokens);
    await pressEscape(this.driver);
  }
}
