import { WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  buildDataTestIdXpath,
  buildXpathByText,
  clickElement,
  isDisplayed,
  waitForElement,
} from "../utils/Helper";

const DIV_FIRST_TOKEN_CONTAINER = "firstToken-container";
const DIV_SECOND_TOKEN_CONTAINER = "secondToken-container";
const DIV_FIRST_TOKEN_SELECTOR_CONTENT = "firstToken-selector-content";
const DIV_SECOND_TOKEN_SELECTOR_CONTENT = "secondToken-selector-content";
const DIV_TOKEN_SELECTOR_ITEM = "tokenList-item";
// const BTN_SUBMIT_SWAP = "submitSwap";
const BTN_SWITCH_TOKENS = "switchTokens";
const BTN_SELECT_FIRST_TOKEN = "firstToken-selector-btn";
const BTN_SELECT_SECOND_TOKEN = "secondToken-selector-btn";
// const INPUT_FIRST_TOKEN = "firstToken-input";
// const INPUT_SECOND_TOKEN = "secondToken-input";

export class Swap {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isDisplayed() {
    const firstTokenContainer = buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER);
    const secondTokenContainer = buildDataTestIdXpath(
      DIV_SECOND_TOKEN_CONTAINER
    );
    const switchBtn = buildDataTestIdXpath(BTN_SWITCH_TOKENS);
    const displayed = await areDisplayed(this.driver, [
      firstTokenContainer,
      secondTokenContainer,
      switchBtn,
    ]);
    return displayed;
  }

  async isFirsttokenSelectorDisplayed() {
    const firstTokenSelector = buildDataTestIdXpath(
      DIV_FIRST_TOKEN_SELECTOR_CONTENT
    );
    const displayed = await isDisplayed(this.driver, firstTokenSelector);
    return displayed;
  }

  async pickPayToken(tokenName: string) {
    const selectFirstToken = buildDataTestIdXpath(BTN_SELECT_FIRST_TOKEN);
    await clickElement(this.driver, selectFirstToken);
    const firstTokenSelector = buildDataTestIdXpath(
      DIV_FIRST_TOKEN_SELECTOR_CONTENT
    );
    await waitForElement(this.driver, firstTokenSelector);
    const firstTokenSelectorButton =
      buildDataTestIdXpath(DIV_TOKEN_SELECTOR_ITEM) +
      buildXpathByText(tokenName);
    await clickElement(this.driver, firstTokenSelectorButton);
  }

  async pickGetToken(tokenName: string) {
    const selectSecondToken = buildDataTestIdXpath(BTN_SELECT_SECOND_TOKEN);
    await clickElement(this.driver, selectSecondToken);
    const secondTokenSelector = buildDataTestIdXpath(
      DIV_SECOND_TOKEN_SELECTOR_CONTENT
    );
    await waitForElement(this.driver, secondTokenSelector);
    const secondTokenSelectorButton =
      buildDataTestIdXpath(DIV_TOKEN_SELECTOR_ITEM) +
      buildXpathByText(tokenName);
    await clickElement(this.driver, secondTokenSelectorButton);
  }
}
