import { By, until, WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import { buildDataTestIdSelector, clickElement, waitForElement } from "../utils/Helper";

//SELECTORS
const TAB_SWAP_TEST_ID =  'trading-swapTab';

export class Swap {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async toggleSwap() {
    const selector = buildDataTestIdSelector(TAB_SWAP_TEST_ID);
    clickElement(this.driver, selector);
  }
}
