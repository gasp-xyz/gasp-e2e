import { By, until, WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import { clickElement, waitForElement } from "../utils/Helper";

//xpaths
const MSG_RECEIVE_TOKENS = `//div[text()='You will receive test tokens']`;
const LBL_YOUR_TOKENS = `//*[contains(text(),'Your tokens')]`;
const BTN_GET_TOKENS = `//button[contains(text(), 'Get Tokens')] `;
const DIV_ASSETS_ITEM = `//div[@class='assets']/div[@class='AssetBox']`;
//const DIV_ASSETS_ITEM_VALUE = `${DIV_ASSETS_ITEM}/span[@class ='value']`
const DIV_MGA_ASSETS_ITEM_VALUE = `//div[@class = 'AssetBox' and //*[text()='MGA']]/span[@class='value']`;
const DIV_MGA_LIQ_POOLS = `//div[@class='PoolsOverview__inner__list__item']`;
const BTN_MGA_LIQ_POOLS_ADD = `//*[small[contains(text(),'Liquidity')] and contains(text(),'Add' ) ]`;
//const BTN_MGA_LIQ_POOLS_REMOVE = `//*[small[contains(text(),'Liquidity')] and contains(text(),'Remove' ) ]`
const INPUT_MGA_ADD_ASSET_VALUE = `//input[@placeholder='0.0']`;

const { uiUri } = getEnvironmentRequiredVars();

export class Mangata {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async go() {
    await this.driver.get(uiUri);
  }
  async navigate() {
    await this.go();
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
  async waitForFaucetToGenerateTokens(timeOut = 120000) {
    await this.driver.wait(
      until.elementLocated(By.xpath(DIV_ASSETS_ITEM)),
      timeOut
    );
  }
  async getAssetValue() {
    await waitForElement(this.driver, DIV_MGA_ASSETS_ITEM_VALUE);
    const value = await (
      await this.driver.findElement(By.xpath(DIV_MGA_ASSETS_ITEM_VALUE))
    ).getText();
    return value;
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
      By.xpath(INPUT_MGA_ADD_ASSET_VALUE)
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
      By.xpath(INPUT_MGA_ADD_ASSET_VALUE)
    );
    let value = "";
    if (input === 1) {
      value = await inputs[0]!.getAttribute("value");
    } else {
      value = await inputs[1]!.getAttribute("value");
    }
    return value;
  }
}
