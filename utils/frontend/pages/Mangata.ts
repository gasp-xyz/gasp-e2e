import { By, WebDriver } from "selenium-webdriver";
import {
  BTC_ASSET_NAME,
  DOT_ASSET_NAME,
  FIVE_MIN,
  MGA_ASSET_NAME,
  USDC_ASSET_NAME,
} from "../../Constants";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import {
  areDisplayed,
  buildDataTestIdXpath,
  clickElement,
  isDisplayed,
  waitForElement,
  waitForElementVisible,
} from "../utils/Helper";
import { Sidebar } from "./Sidebar";

//xpaths
const MSG_RECEIVE_TOKENS = `//div[text()='You will receive test tokens']`;
const LBL_YOUR_TOKENS = `//*[contains(text(),'Your tokens')]`;
const BTN_GET_TOKENS = `//*[contains(text(), 'Get Tokens')] `;

const BTN_TAB_SWAP = "trading-swapTab";
const BTN_TAB_POOL = "trading-poolTab";
const INPUT_SWAP_YOU_PAY = "tradingSwapTab-firstTokenInput";
const INPUT_SWAP_YOU_GET = "tradingSwapTab-secondTokenInput";
const DIV_SWITCH_TOKENS = "tradingSwapTab-switchTokensButton";

const DIV_MGA_LOGO = `//*[contains(@alt,'Mangata App Logo')]`;
const BTN_SELECT_TOKENS = `//*[text() = 'Select Token' ]`;
const LI_TOKEN_ELEM = `//*[contains(@data-testId, 'TokensModal-asset' )]`;

const DIV_MGA_LIQ_POOLS = `//div[@class='PoolsOverview__inner__list__item']`;
const BTN_MGA_LIQ_POOLS_ADD = `//*[small[contains(text(),'Liquidity')] and contains(text(),'Add' ) ]`;
const INPUT_MGA_ADD_ASSET_VALUE = `//input[@placeholder='0.0']`;

export class Mangata {
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
  async navigate() {
    await this.go();
    await new Sidebar(this.driver).waitForLoad();
    await waitForElement(this.driver, LBL_YOUR_TOKENS);
  }
  async isGetTokensVisible() {
    return await (
      await this.driver.findElement(By.xpath(MSG_RECEIVE_TOKENS))
    ).isDisplayed();
  }
  async clickOnGetTokens() {
    await waitForElement(this.driver, BTN_GET_TOKENS);
    await clickElement(this.driver, BTN_GET_TOKENS);
  }
  async waitForFaucetToGenerateTokens(timeOut = FIVE_MIN) {
    const sidebar = new Sidebar(this.driver);
    const promises: Promise<void>[] = [];
    [MGA_ASSET_NAME, DOT_ASSET_NAME, BTC_ASSET_NAME, USDC_ASSET_NAME].forEach(
      async function (value) {
        promises.push(sidebar.waitUntilTokenAvailable(value, timeOut));
      },
    );
    await Promise.all(promises);
  }
  async getAssetValue(assetName: string) {
    const sidebar = new Sidebar(this.driver);
    return await sidebar.getAssetValue(assetName);
  }

  async isSwapFrameDisplayed() {
    const swapElements = [
      buildDataTestIdXpath(BTN_TAB_SWAP),
      buildDataTestIdXpath(BTN_TAB_POOL),
      buildDataTestIdXpath(INPUT_SWAP_YOU_PAY),
      buildDataTestIdXpath(INPUT_SWAP_YOU_GET),
      buildDataTestIdXpath(DIV_SWITCH_TOKENS),
    ];
    return areDisplayed(this.driver, swapElements);
  }

  async isLogoDisplayed() {
    await waitForElementVisible(this.driver, DIV_MGA_LOGO);
    return await isDisplayed(this.driver, DIV_MGA_LOGO);
  }
  async clickOnSelectTokens() {
    await clickElement(this.driver, BTN_SELECT_TOKENS);
  }
  async getAvailableTokenList() {
    const elements = await this.driver.findElements(By.xpath(LI_TOKEN_ELEM));
    const promises = elements.map((listItem) => listItem.getText());
    return await Promise.all(promises);
  }

  async clickOnFirstOwnedLiquidityPool() {
    await waitForElement(this.driver, DIV_MGA_LIQ_POOLS);
    await clickElement(this.driver, DIV_MGA_LIQ_POOLS);
  }

  async clickOnAddLiquidityPoolBtn() {
    await waitForElement(this.driver, BTN_MGA_LIQ_POOLS_ADD);
    await clickElement(this.driver, BTN_MGA_LIQ_POOLS_ADD);
  }

  async clickOnRemoveLiquidityPoolBtn() {
    await waitForElement(this.driver, BTN_MGA_LIQ_POOLS_ADD);
    await clickElement(this.driver, BTN_MGA_LIQ_POOLS_ADD);
  }
  async addAmount(inputValue: string, input = 1) {
    await waitForElement(this.driver, INPUT_MGA_ADD_ASSET_VALUE);
    const inputs = await this.driver.findElements(
      By.xpath(INPUT_MGA_ADD_ASSET_VALUE),
    );
    if (input === 1) {
      await inputs[0]!.sendKeys(inputValue);
    } else {
      await inputs[1]!.sendKeys(inputValue);
    }
  }
  async getAmount(input = 1): Promise<string> {
    await waitForElement(this.driver, INPUT_MGA_ADD_ASSET_VALUE);
    await sleep(3000);
    const inputs = await this.driver.findElements(
      By.xpath(INPUT_MGA_ADD_ASSET_VALUE),
    );
    let value: string;
    if (input === 1) {
      value = await inputs[0]!.getAttribute("value");
    } else {
      value = await inputs[1]!.getAttribute("value");
    }
    return value;
  }
}
