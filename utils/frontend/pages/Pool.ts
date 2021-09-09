import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  waitForElement,
  writeText,
} from "../utils/Helper";
import { Mangata } from "./Mangata";

//SELECTORS
const TAB_POOL_TEST_ID = "trading-poolTab";
const DIV_POOL_TOKEN1 = "tradingPoolTab-leftAssetInput";
const DIV_POOL_TOKEN2 = "tradingPoolTab-rightAssetInput";
const BTN_POOL_PROVIDE = "tradingPoolTab-provideBtn";

export class Pool {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  private btnToken1Locator = buildDataTestIdXpath(DIV_POOL_TOKEN1) + "//button";
  private btnToken2Locator = buildDataTestIdXpath(DIV_POOL_TOKEN2) + "//button";
  private inputToken1Locator =
    buildDataTestIdXpath(DIV_POOL_TOKEN1) + "//input";
  private inputToken2Locator =
    buildDataTestIdXpath(DIV_POOL_TOKEN2) + "//input";

  async togglePool() {
    const selector = buildDataTestIdXpath(TAB_POOL_TEST_ID);
    await clickElement(this.driver, selector);
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

  async provideToPool() {
    const tradeBtn = buildDataTestIdXpath(BTN_POOL_PROVIDE);
    await waitForElement(this.driver, tradeBtn);
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
    const assetTestId = `assetSelectModal-asset-${assetName}`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    await clickElement(this.driver, assetLocator);
  }
  async getToken2Text(): Promise<string> {
    return await new Mangata(this.driver).getAmount(2);
  }
  async getToken1Text(): Promise<string> {
    return await new Mangata(this.driver).getAmount(1);
  }
}
