import { WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  buildDataTestIdXpath,
  clickElement,
  getText,
  isDisplayed,
  scrollIntoView,
} from "../utils/Helper";

const TOKENS_PAGE = "tokens-page";
const BUTTON_ALL_TOKENS = "all-tokens";
const BUTTON_MY_TOKENS = "my-tokens";
const TOKEN_ROW_SUFFIX = "-token-row";
const TOKEN_ROW_ICON = "token-icon";
const TOKEN_ROW_PRICE = "priceInUSD";
const TOKEN_ROW_PRICE_CHANGE = "priceChange24hInPerc";
const TOKEN_ROW_VOLUME = "volume24hInUSD";
const TOKEN_ROW_VOLUME_CHANGE = "volumeChange24hInPerc";

export class Tokens {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isDisplayed() {
    const page = buildDataTestIdXpath(TOKENS_PAGE);
    const displayed = await isDisplayed(this.driver, page);
    return displayed;
  }

  async clickTokenRow(tokenName: string) {
    const itemXpath =
      buildDataTestIdXpath(tokenName + TOKEN_ROW_SUFFIX) +
      buildDataTestIdXpath(TOKEN_ROW_ICON);
    await scrollIntoView(this.driver, itemXpath);
    await clickElement(this.driver, itemXpath);
  }

  async clickAllTokens() {
    const itemXpath = buildDataTestIdXpath(BUTTON_ALL_TOKENS);
    await scrollIntoView(this.driver, itemXpath);
    await clickElement(this.driver, itemXpath);
  }

  async clickMyTokens() {
    const itemXpath = buildDataTestIdXpath(BUTTON_MY_TOKENS);
    await scrollIntoView(this.driver, itemXpath);
    await clickElement(this.driver, itemXpath);
  }

  async isTokenRowDisplayed(tokenName: string) {
    const itemXpath = buildDataTestIdXpath(tokenName + TOKEN_ROW_SUFFIX);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async areTokenRowStatsDisplayed(tokenName: string) {
    const tokenRow = buildDataTestIdXpath(tokenName + TOKEN_ROW_SUFFIX);

    const price = tokenRow + buildDataTestIdXpath(TOKEN_ROW_PRICE);
    const volume = tokenRow + buildDataTestIdXpath(TOKEN_ROW_VOLUME);
    const priceChange = tokenRow + buildDataTestIdXpath(TOKEN_ROW_PRICE_CHANGE);
    const volumeChange =
      tokenRow + buildDataTestIdXpath(TOKEN_ROW_VOLUME_CHANGE);
    const tokenIcon = tokenRow + buildDataTestIdXpath(TOKEN_ROW_ICON);

    const displayed = await areDisplayed(this.driver, [
      price,
      volume,
      priceChange,
      volumeChange,
      tokenIcon,
    ]);
    return displayed;
  }

  async getTokenPrice(tokenName: string) {
    const tokenRow = buildDataTestIdXpath(tokenName + TOKEN_ROW_SUFFIX);
    const price = tokenRow + buildDataTestIdXpath(TOKEN_ROW_PRICE);
    const text = await getText(this.driver, price);
    const floatValue = parseFloat(text);
    return floatValue;
  }

  async getTokenVolume(tokenName: string) {
    const tokenRow = buildDataTestIdXpath(tokenName + TOKEN_ROW_SUFFIX);
    const price = tokenRow + buildDataTestIdXpath(TOKEN_ROW_VOLUME);
    const text = await getText(this.driver, price);
    const floatValue = parseFloat(text);
    return floatValue;
  }
}
