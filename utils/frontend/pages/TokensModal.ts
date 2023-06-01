import { WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import {
  areDisplayed,
  buildDataTestIdXpath,
  buildDataTestIdXpathFunction,
  clickElement,
  getText,
  isDisplayed,
  waitForElementVisible,
} from "../utils/Helper";

//SELECTORS
const DIV_WRAPPER = "TokensModal";

export class TokensModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isModalVisible() {
    const wrapper = buildDataTestIdXpathFunction(DIV_WRAPPER, "contains");
    return isDisplayed(this.driver, wrapper);
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
    await sleep(3000);
    const assetTestId = `TokensModal-token-${assetName}`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    await clickElement(this.driver, assetLocator);
  }
}
