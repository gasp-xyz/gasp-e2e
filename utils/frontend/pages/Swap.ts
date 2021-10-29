import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  getAttribute,
  waitForElement,
  writeText,
} from "../utils/Helper";

//SELECTORS
const TAB_SWAP_TEST_ID = "trading-swapTab";
const DIV_SWAP_PAY = "tradingSwapTab-leftAssetInput";
const DIV_SWAP_GET = "tradingSwapTab-rightAssetInput";
const BTN_SWAP_TRADE = "tradingSwapTab-tradeBtn";

export class Swap {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  private btnPayLocator = buildDataTestIdXpath(DIV_SWAP_PAY) + "//button";
  private btnGetLocator = buildDataTestIdXpath(DIV_SWAP_GET) + "//button";
  private inputPayLocator = buildDataTestIdXpath(DIV_SWAP_PAY) + "//input";
  private inputGetLocator = buildDataTestIdXpath(DIV_SWAP_GET) + "//input";
  private btnPayMaxLocator =
    buildDataTestIdXpath(DIV_SWAP_PAY) + "//button[contains(text(),'Max')]";
  private btnGetMaxLocator =
    buildDataTestIdXpath(DIV_SWAP_GET) + "//button[contains(text(),'Max')]";

  async toggleSwap() {
    const selector = buildDataTestIdXpath(TAB_SWAP_TEST_ID);
    await clickElement(this.driver, selector);
  }
  /**
   * Select one asset to pay with.
   * @param assetName : MGA, mETH, mDOT, mBTC, mUSDC
   */
  async selectPayAsset(assetName: string = "MGA") {
    await clickElement(this.driver, this.btnPayLocator);
    await this.selectAssetFromModalList(assetName);
  }
  async selectGetAsset(assetName: string) {
    await clickElement(this.driver, this.btnGetLocator);
    await this.selectAssetFromModalList(assetName);
  }
  async clickPayMaxBtn() {
    await clickElement(this.driver, this.btnPayMaxLocator);
  }
  async clickGetMaxBtn() {
    await clickElement(this.driver, this.btnGetMaxLocator);
  }

  async doSwap() {
    const tradeBtn = buildDataTestIdXpath(BTN_SWAP_TRADE);
    await waitForElement(this.driver, tradeBtn);
    const enabled = await (
      await this.driver.findElement(By.xpath(tradeBtn))
    ).isEnabled();
    if (!enabled) {
      throw new Error("Trade btn is not enabled!");
    }
    await clickElement(this.driver, tradeBtn);
  }

  async fetchGetAssetAmount() {
    const text = await getAttribute(this.driver, this.inputGetLocator, "value");
    return text;
  }
  async fetchPayAssetAmount() {
    const text = await getAttribute(this.driver, this.inputPayLocator, "value");
    return text;
  }
  async addPayAssetAmount(amount: string) {
    await clickElement(this.driver, this.inputPayLocator);
    await writeText(this.driver, this.inputPayLocator, amount);
  }
  async addGetAssetAmount(amount: string) {
    await clickElement(this.driver, this.inputGetLocator);
    await writeText(this.driver, this.inputGetLocator, amount);
  }

  private async selectAssetFromModalList(assetName: string) {
    const assetTestId = `assetSelectModal-asset-${assetName}`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    await clickElement(this.driver, assetLocator);
  }
}
