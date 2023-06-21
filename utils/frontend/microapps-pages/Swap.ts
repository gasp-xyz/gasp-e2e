import { By, WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  buildDataTestIdXpath,
  buildXpathByText,
  clickElement,
  getAttribute,
  isDisplayed,
  waitForElement,
  waitForElementEnabled,
  waitForElementVisible,
  writeText,
} from "../utils/Helper";

const DIV_FIRST_TOKEN_CONTAINER = "firstToken-container";
const DIV_SECOND_TOKEN_CONTAINER = "secondToken-container";
const DIV_FIRST_TOKEN_SELECTOR_CONTENT = "firstToken-selector-content";
const DIV_SECOND_TOKEN_SELECTOR_CONTENT = "secondToken-selector-content";
const DIV_TOKEN_SELECTOR_ITEM = "tokenList-item";
const DIV_TRADE_RATE = "trade-rate";
const DIV_TRADE_DETAILS = "trade-details";
const DIV_MIN_RECEIVED = "minimumRecieved";
const DIV_PRICE_IMPACT = "priceImpact";
const DIV_COMMISION = "commission";
const DIV_FEE = "fee";
const DIV_TRADE_ROUTE_DETAILS = "routingDetails";
const DIV_MIDDLE_POOL = "middle-pool";
const BTN_SUBMIT_SWAP = "submitSwap";
const BTN_SWITCH_TOKENS = "switchTokens";
const BTN_TOGGLE_TRADE_DETAILS = "toggle-trade-details";
const BTN_SELECT_FIRST_TOKEN = "firstToken-selector-btn";
const BTN_SELECT_SECOND_TOKEN = "secondToken-selector-btn";
const BTN_TRADE_ROUTE_DETAILS_CLOSE = "routingDetails-close";
const INPUT_FIRST_TOKEN = "firstToken-input";
const INPUT_SECOND_TOKEN = "secondToken-input";

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

  async setPayTokenAmount(amount: string) {
    const inputPayLocator = buildDataTestIdXpath(INPUT_FIRST_TOKEN);
    await clickElement(this.driver, inputPayLocator);
    await writeText(this.driver, inputPayLocator, amount);
  }

  async setGetTokenAmount(amount: string) {
    const inputGetLocator = buildDataTestIdXpath(INPUT_SECOND_TOKEN);
    await clickElement(this.driver, inputGetLocator);
    await writeText(this.driver, inputGetLocator, amount);
  }

  async fetchGetAssetAmount() {
    const inputGetLocator = buildDataTestIdXpath(INPUT_SECOND_TOKEN);
    const text = await getAttribute(this.driver, inputGetLocator, "value");
    return text;
  }
  async fetchPayAssetAmount() {
    const inputPayLocator = buildDataTestIdXpath(INPUT_FIRST_TOKEN);
    const text = await getAttribute(this.driver, inputPayLocator, "value");
    return text;
  }

  async waitForSwapButtonEnabled() {
    const firstTokenSelector = buildDataTestIdXpath(BTN_SUBMIT_SWAP);
    await waitForElementEnabled(this.driver, firstTokenSelector);
  }

  async isSwapButtonEnabled() {
    const firstTokenSelector = buildDataTestIdXpath(BTN_SUBMIT_SWAP);
    const enabled = await (
      await this.driver.findElement(By.xpath(firstTokenSelector))
    ).isEnabled();
    return enabled;
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

  async toggleTradeDetails() {
    const tradeDetailsToggleButton = buildDataTestIdXpath(
      BTN_TOGGLE_TRADE_DETAILS
    );
    await clickElement(this.driver, tradeDetailsToggleButton);
  }

  async toggleRouteDetails() {
    const tradeRouteDetails = buildDataTestIdXpath(DIV_TRADE_ROUTE_DETAILS);
    await clickElement(this.driver, tradeRouteDetails);
  }

  async isTradeRateDisplayed() {
    const tradeRate = buildDataTestIdXpath(DIV_TRADE_RATE);
    const displayed = await isDisplayed(this.driver, tradeRate);
    return displayed;
  }

  async areTradeDetailsDisplayed() {
    const tradeDetailsContainer = buildDataTestIdXpath(DIV_TRADE_DETAILS);
    await waitForElement(this.driver, tradeDetailsContainer);

    const minReceived = buildDataTestIdXpath(DIV_MIN_RECEIVED);
    const priceImpact = buildDataTestIdXpath(DIV_PRICE_IMPACT);
    const commission = buildDataTestIdXpath(DIV_COMMISION);
    const fee = buildDataTestIdXpath(DIV_FEE);

    const displayed = await areDisplayed(this.driver, [
      minReceived,
      priceImpact,
      commission,
      fee,
    ]);
    return displayed;
  }

  async areRouteDetailsDisplayed(
    firstTokenName: string,
    secondTokenName: string
  ) {
    const tradeRouteDetailsClose = buildDataTestIdXpath(
      BTN_TRADE_ROUTE_DETAILS_CLOSE
    );
    const routeDetailsXpath = buildDataTestIdXpath(DIV_TRADE_ROUTE_DETAILS);
    const firstTokenIcon =
      routeDetailsXpath + buildDataTestIdXpath("token-icon-" + firstTokenName);
    const secondTokenIcon =
      routeDetailsXpath + buildDataTestIdXpath("token-icon-" + secondTokenName);
    const middlePool =
      routeDetailsXpath + buildDataTestIdXpath(DIV_MIDDLE_POOL);
    await waitForElementVisible(this.driver, middlePool);

    const displayed = await areDisplayed(this.driver, [
      firstTokenIcon,
      secondTokenIcon,
      middlePool,
      tradeRouteDetailsClose,
    ]);
    return displayed;
  }
}
