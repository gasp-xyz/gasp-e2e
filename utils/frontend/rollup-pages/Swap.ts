import { By, WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByMultiText,
  clickElement,
  getAttribute,
  getText,
  isDisplayed,
  scrollIntoView,
  waitForElement,
  waitForElementEnabled,
  waitForElementVisible,
  writeText,
} from "../utils/Helper";
import { sleep } from "../../utils";

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
const DIV_SWAP_FEE_XPATH = "//*[@data-tooltip-id='swapFee']";
const BTN_SUBMIT_SWAP = "submitSwap";
const BTN_SWITCH_TOKENS = "switchTokens";
const BTN_TOGGLE_TRADE_DETAILS = "toggle-trade-details";
const BTN_SELECT_FIRST_TOKEN = "firstToken-selector-btn";
const BTN_SELECT_SECOND_TOKEN = "secondToken-selector-btn";
const BTN_TRADE_ROUTE_DETAILS_CLOSE = "routingDetails-close";
const BTN_SWAP_SETTINGS_XPATH =
  "//button[contains(@class, 'outline-none min-w-[0] bg-transparent')]";
const INPUT_FIRST_TOKEN = "firstToken-input";
const INPUT_SECOND_TOKEN = "secondToken-input";
const INPUT_AUTOROUTING_CHECKBOX_XPATH =
  "//label[contains(@class, 'rounded-full self-start')]";

export enum SwapActionType {
  Swap,
  Network,
}

export class Swap {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  swapAction: Record<SwapActionType, string> = {
    [SwapActionType.Swap]: "Swap tokens",
    [SwapActionType.Network]: "Switch to Ethereum",
  };

  async isDisplayed() {
    const firstTokenContainer = buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER);
    const secondTokenContainer = buildDataTestIdXpath(
      DIV_SECOND_TOKEN_CONTAINER,
    );
    const switchBtn = buildDataTestIdXpath(BTN_SWITCH_TOKENS);
    return await areDisplayed(this.driver, [
      firstTokenContainer,
      secondTokenContainer,
      switchBtn,
    ]);
  }

  async switchTokens() {
    const switchButton = buildDataTestIdXpath(BTN_SWITCH_TOKENS);
    await clickElement(this.driver, switchButton);
  }

  async openSwapSettings() {
    await clickElement(this.driver, BTN_SWAP_SETTINGS_XPATH);
  }

  async closeSwapSettings() {
    await clickElement(this.driver, BTN_SWAP_SETTINGS_XPATH);
  }

  async toggleAutorouting() {
    await waitForElementVisible(this.driver, INPUT_AUTOROUTING_CHECKBOX_XPATH);
    await sleep(1500);
    await clickElement(this.driver, INPUT_AUTOROUTING_CHECKBOX_XPATH);
  }

  async isFirstTokenSelectorDisplayed() {
    const firstTokenSelector = buildDataTestIdXpath(
      DIV_FIRST_TOKEN_SELECTOR_CONTENT,
    );
    return await isDisplayed(this.driver, firstTokenSelector);
  }

  async pickPayToken(tokenName: string, origin = "Native") {
    const selectFirstToken = buildDataTestIdXpath(BTN_SELECT_FIRST_TOKEN);
    await clickElement(this.driver, selectFirstToken);
    const firstTokenSelector = buildDataTestIdXpath(
      DIV_FIRST_TOKEN_SELECTOR_CONTENT,
    );
    await waitForElement(this.driver, firstTokenSelector);
    const firstTokenSelectorButton =
      buildDataTestIdXpath(DIV_TOKEN_SELECTOR_ITEM) +
      buildXpathByMultiText([tokenName, origin]);
    await scrollIntoView(this.driver, firstTokenSelectorButton);
    await clickElement(this.driver, firstTokenSelectorButton);
  }

  async fetchPayTokenName() {
    const tokenSelector =
      buildDataTestIdXpath(BTN_SELECT_FIRST_TOKEN) +
      "//*[contains(@class, 'font-normal')]";
    return await getText(this.driver, tokenSelector);
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
    return await getAttribute(this.driver, inputGetLocator, "value");
  }

  async fetchGetTokenName() {
    const tokenSelector =
      buildDataTestIdXpath(BTN_SELECT_SECOND_TOKEN) +
      "//*[contains(@class, 'font-normal')]";
    return await getText(this.driver, tokenSelector);
  }

  async fetchPayAssetAmount() {
    const inputPayLocator = buildDataTestIdXpath(INPUT_FIRST_TOKEN);
    return await getAttribute(this.driver, inputPayLocator, "value");
  }

  async fetchMinimumReceivedAmount() {
    const inputGetLocator = buildDataTestIdXpath(DIV_MIN_RECEIVED + "-value");
    const text = await getText(this.driver, inputGetLocator);
    return parseFloat(text.split(" ")[0]);
  }

  async fetchSwapFee() {
    const text = await getText(this.driver, DIV_SWAP_FEE_XPATH);
    return parseInt(text.split(" ")[0]);
  }

  async isSwapFee() {
    return isDisplayed(this.driver, DIV_SWAP_FEE_XPATH);
  }

  async isSwapFeeAlert() {
    const swapAlertState =
      buildDataTestIdXpath(DIV_FEE) + "//*[contains(@class, 'text-alert')]";
    return await isDisplayed(this.driver, swapAlertState);
  }

  async waitForSwapButtonEnabled() {
    const firstTokenSelector = buildDataTestIdXpath(BTN_SUBMIT_SWAP);
    await waitForElementEnabled(this.driver, firstTokenSelector);
  }

  async isSwapButtonEnabled() {
    const firstTokenSelector = buildDataTestIdXpath(BTN_SUBMIT_SWAP);
    return await (
      await this.driver.findElement(By.xpath(firstTokenSelector))
    ).isEnabled();
  }

  async clickSwapButton() {
    const firstTokenSelector = buildDataTestIdXpath(BTN_SUBMIT_SWAP);
    await (await this.driver.findElement(By.xpath(firstTokenSelector))).click();
  }

  async clickSwapButtonByAction(action: SwapActionType) {
    const xpath = buildXpathByElementText("button", this.swapAction[action]);
    await clickElement(this.driver, xpath);
  }

  async pickGetToken(tokenName: string, origin = "Native") {
    const selectSecondToken = buildDataTestIdXpath(BTN_SELECT_SECOND_TOKEN);
    await clickElement(this.driver, selectSecondToken);
    const secondTokenSelector = buildDataTestIdXpath(
      DIV_SECOND_TOKEN_SELECTOR_CONTENT,
    );
    await waitForElement(this.driver, secondTokenSelector);
    const secondTokenSelectorButton =
      buildDataTestIdXpath(DIV_TOKEN_SELECTOR_ITEM) +
      buildXpathByMultiText([tokenName, origin]);
    await scrollIntoView(this.driver, secondTokenSelectorButton);
    await clickElement(this.driver, secondTokenSelectorButton);
  }

  async acceptGetTokenWarning() {
    const secondTokenSelector = buildDataTestIdXpath(
      DIV_SECOND_TOKEN_SELECTOR_CONTENT,
    );
    await waitForElement(this.driver, secondTokenSelector, 2000);
    const acceptTokenWarningAccept =
      secondTokenSelector +
      buildXpathByElementText("button", "Ok, I understand");
    await clickElement(this.driver, acceptTokenWarningAccept);
  }

  async acceptPayTokenWarning() {
    const firstTokenSelector = buildDataTestIdXpath(
      DIV_FIRST_TOKEN_SELECTOR_CONTENT,
    );
    await waitForElement(this.driver, firstTokenSelector, 2000);
    const acceptTokenWarningAccept =
      firstTokenSelector +
      buildXpathByElementText("button", "Ok, I understand");
    await clickElement(this.driver, acceptTokenWarningAccept);
  }

  async toggleTradeDetails() {
    const tradeDetailsToggleButton = buildDataTestIdXpath(
      BTN_TOGGLE_TRADE_DETAILS,
    );
    await clickElement(this.driver, tradeDetailsToggleButton);
  }

  async toggleRouteDetails() {
    const tradeRouteDetails = buildDataTestIdXpath(DIV_TRADE_ROUTE_DETAILS);
    await clickElement(this.driver, tradeRouteDetails);
  }

  async isTradeRateDisplayed() {
    const tradeRate = buildDataTestIdXpath(DIV_TRADE_RATE);
    return await isDisplayed(this.driver, tradeRate);
  }

  async areTradeDetailsDisplayed(gasless = false) {
    const tradeDetailsContainer = buildDataTestIdXpath(DIV_TRADE_DETAILS);
    await waitForElement(this.driver, tradeDetailsContainer);

    const minReceived = buildDataTestIdXpath(DIV_MIN_RECEIVED);
    const priceImpact = buildDataTestIdXpath(DIV_PRICE_IMPACT);
    const commission = buildDataTestIdXpath(DIV_COMMISION);
    const fee = buildDataTestIdXpath(DIV_FEE);
    await waitForElementVisible(this.driver, commission);

    if (gasless) {
      return await areDisplayed(this.driver, [
        minReceived,
        priceImpact,
        commission,
      ]);
    } else {
      return await areDisplayed(this.driver, [
        minReceived,
        priceImpact,
        commission,
        fee,
      ]);
    }
  }

  async areRouteDetailsDisplayed(
    firstTokenName: string,
    secondTokenName: string,
  ) {
    const tradeRouteDetailsClose = buildDataTestIdXpath(
      BTN_TRADE_ROUTE_DETAILS_CLOSE,
    );
    const routeDetailsXpath = buildDataTestIdXpath(DIV_TRADE_ROUTE_DETAILS);
    const firstTokenIcon =
      routeDetailsXpath + buildDataTestIdXpath("token-icon-" + firstTokenName);
    const secondTokenIcon =
      routeDetailsXpath + buildDataTestIdXpath("token-icon-" + secondTokenName);
    const middlePool =
      routeDetailsXpath + buildDataTestIdXpath(DIV_MIDDLE_POOL);
    await waitForElementVisible(this.driver, middlePool);

    return await areDisplayed(this.driver, [
      firstTokenIcon,
      secondTokenIcon,
      middlePool,
      tradeRouteDetailsClose,
    ]);
  }
}
