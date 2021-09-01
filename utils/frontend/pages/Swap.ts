import { By, until, WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import {
  buildDataTestIdSelector,
  buildDataTestIdXpath,
  clickElement,
  waitForElement,
} from "../utils/Helper";

//SELECTORS
const TAB_SWAP_TEST_ID = "trading-swapTab";
const SWAP_DIV_PAY = "tradingSwapTab-leftAssetInput";

export class Swap {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  private btnBuyLocator = buildDataTestIdXpath(SWAP_DIV_PAY) + "//button";

  async toggleSwap() {
    const selector = buildDataTestIdSelector(TAB_SWAP_TEST_ID);
    clickElement(this.driver, selector);
  }
  async selectPayAsset(assetName: string) {
    throw new Error("Method not implemented.");
  }
  async doSwap() {
    throw new Error("Method not implemented.");
  }
  async addFirstAssetAmount(amount: string) {
    throw new Error("Method not implemented.");
  }
  async selectGetAsset(mETH_ASSET_NAME: string) {
    throw new Error("Method not implemented.");
  }
}
