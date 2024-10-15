import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildHrefXpath,
  clickElement,
  waitForElementVisible,
  isDisplayed,
  buildXpathByElementText,
  writeTextManual,
  buildXpathByText,
  waitInputValueSetInterval,
  writeText,
  getAttribute,
  isEnabled,
  waitForElementEnabled,
} from "../utils/Helper";
import toNumber from "lodash-es/toNumber";

const REMOVE_AMOUNT_INPUT = "removedLiq-percent-input";
const BUTTON_ADD_LIQ = "add-liquidity-button";
const BUTTON_SUBMIT = "submit-button";
const DIV_FIRST_TOKEN_CONTAINER = "firstToken-container";
const DIV_FIRST_TOKEN_INPUT = "firstToken-input";
const DIV_SECOND_TOKEN_CONTAINER = "secondToken-container";
const DIV_SECOND_TOKEN_INPUT = "secondToken-input";

export class MyPositionsPage {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async chooseOverviewPage() {
    const overviewPageXpath = buildDataTestIdXpath("Overview-item");
    await clickElement(this.driver, overviewPageXpath);
  }

  async chooseLiqMiningPage() {
    const liqMiningPageXpath = buildDataTestIdXpath("Liquidity-Mining-item");
    await clickElement(this.driver, liqMiningPageXpath);
  }

  async submitAddLiq() {
    const submitAddXpath = buildDataTestIdXpath(BUTTON_SUBMIT);
    await clickElement(this.driver, submitAddXpath);
  }

  async isLiqPoolDisplayed(firstTokenName: string, secondTokenName: string) {
    const PoolName = "pool-" + firstTokenName + "-" + secondTokenName;
    const itemXpath = buildDataTestIdXpath(PoolName);
    return isDisplayed(this.driver, itemXpath);
  }

  async isActiveRewardsDisplayed() {
    const itemXpath = buildDataTestIdXpath("active-reward-number");
    return isDisplayed(this.driver, itemXpath);
  }

  async isRewardHintDisplayed() {
    const itemXpath = buildDataTestIdXpath("reward-hint");
    return isDisplayed(this.driver, itemXpath);
  }

  async isClaimableRewardsDisplayed() {
    const itemXpath = buildDataTestIdXpath("claimable-rewards-value");
    return isDisplayed(this.driver, itemXpath);
  }

  async isLpTokensValuesDisplayed() {
    const itemXpath = buildDataTestIdXpath("active-eligible-lp-tokens");
    return isDisplayed(this.driver, itemXpath);
  }

  async clickPoolPosition(firstTokenName: string, secondTokenName: string) {
    const PoolName = "/positions/" + firstTokenName + "-" + secondTokenName;
    const hrefXpath = buildHrefXpath(PoolName);
    await clickElement(this.driver, hrefXpath);
  }

  async waitForPoolPositionsVisible() {
    const rewardsLocator = buildDataTestIdXpath("user-rewards-panel");
    await waitForElementVisible(this.driver, rewardsLocator, 8000);
  }

  async setupRemovableLiquidity() {
    const removeButtonXpath = buildDataTestIdXpath("remove-button");
    await clickElement(this.driver, removeButtonXpath);
    const removeAmountXpath = buildDataTestIdXpath("50%-button");
    await clickElement(this.driver, removeAmountXpath);
    const feeValueXpath = buildDataTestIdXpath("removeLiq-fee-value");
    await waitForElementVisible(this.driver, feeValueXpath, 12000);
  }

  async setupRemoveLiquidityPercentage(amount: string) {
    const removeButtonXpath = buildDataTestIdXpath("remove-button");
    await clickElement(this.driver, removeButtonXpath);
    const removeAmountXpath = buildDataTestIdXpath(REMOVE_AMOUNT_INPUT);
    await writeTextManual(this.driver, removeAmountXpath, amount);
  }

  async waitForFeeVisible() {
    const feeValueXpath = buildDataTestIdXpath("removeLiq-fee-value-anchor");
    await waitForElementVisible(this.driver, feeValueXpath, 12000);
  }

  async waitForAddLiqFeeVisible() {
    const feeValueXpath = "//*[@data-tooltip-id='add-liq-fee-tooltip']";
    await waitForElementVisible(this.driver, feeValueXpath, 12000);
  }

  async clickRemoveLiquidity() {
    const submitSwapXpath = buildDataTestIdXpath("submitSwap");
    await clickElement(this.driver, submitSwapXpath);
  }

  async isSubmitEnabled() {
    const submitSwapXpath = buildDataTestIdXpath("submitSwap");
    await isEnabled(this.driver, submitSwapXpath);
  }

  async clickSwitchNetwork(network = "Holesky") {
    const xpath = buildXpathByElementText("button", `Switch to ${network}`);
    await clickElement(this.driver, xpath);
  }

  async checkPromPoolPosition(firstTokenName: string, secondTokenName: string) {
    const PoolName = "pool-" + firstTokenName + "-" + secondTokenName;
    const poolNameXpath = buildDataTestIdXpath(PoolName);
    const activatedTokensXpath = buildDataTestIdXpath(
      "activated-LP-tokens-value",
    );
    const myPoolPosition = await this.driver.findElement(
      By.xpath(poolNameXpath + activatedTokensXpath),
    );
    const myPoolPositionText = await myPoolPosition.getText();
    const myPoolPositionValue = toNumber(myPoolPositionText);
    return myPoolPositionValue;
  }

  async checkNonPromPoolPosition(
    firstTokenName: string,
    secondTokenName: string,
  ) {
    const PoolName = "pool-" + firstTokenName + "-" + secondTokenName;
    const poolNameXpath = buildDataTestIdXpath(PoolName);
    const activatedTokensXpath = buildDataTestIdXpath("pool-share-value");
    const myPoolPosition = await this.driver.findElement(
      By.xpath(poolNameXpath + activatedTokensXpath),
    );
    const myPoolPositionText = await myPoolPosition.getText();
    const myPoolPositionNumber = myPoolPositionText.replace(",", "");
    const myPoolPositionValue = toNumber(myPoolPositionNumber);
    return myPoolPositionValue;
  }

  async waitForLpPositionVisible() {
    const rewardsLocator = buildDataTestIdXpath("positionLP-anchor");
    await waitForElementVisible(this.driver, rewardsLocator, 8000);
  }

  async getPoolPositionTokensValues() {
    const liquidityTokenXpath = buildDataTestIdXpath("positionLP-anchor");
    const liquidityTokenValue = await this.driver.findElement(
      By.xpath(liquidityTokenXpath),
    );
    const liquidityTokenText = await liquidityTokenValue.getText();
    const myPoolPositionTextReplaced = liquidityTokenText.replace(",", "");
    const liquidityTokenNumber = toNumber(myPoolPositionTextReplaced);
    const firstTokenXpath = buildDataTestIdXpath("positionTokenA-anchor");
    const firstTokenValue = await this.driver.findElement(
      By.xpath(firstTokenXpath),
    );
    const firstTokenText = await firstTokenValue.getText();
    const firstTokenTextReplaced = firstTokenText.replace(",", "");
    const firstTokenNumber = toNumber(firstTokenTextReplaced);
    const secondTokenXpath = buildDataTestIdXpath("positionTokenB-anchor");
    const secondTokenValue = await this.driver.findElement(
      By.xpath(secondTokenXpath),
    );
    const secondTokenText = await secondTokenValue.getText();
    const secondTokenTextReplaced = secondTokenText.replace(",", "");
    const secondTokenNumber = toNumber(secondTokenTextReplaced);
    return {
      liquidityTokenValue: liquidityTokenNumber,
      firstTokenValue: firstTokenNumber,
      secondTokenValue: secondTokenNumber,
    };
  }

  async waitCalculatingFee() {
    const feeAmountLocator = buildDataTestIdXpath("fee-amount");
    await waitForElementVisible(this.driver, feeAmountLocator, 20000);
  }

  async expandPoolPositonCard() {
    const activateLiquidityXpath =
      buildXpathByElementText("span", "Show more") + "[1]";
    await clickElement(this.driver, activateLiquidityXpath);
  }

  async activateAllLiq() {
    const activateLiquidityXpath = buildDataTestIdXpath("activate");
    await clickElement(this.driver, activateLiquidityXpath);
  }

  async deactivateAllLiq() {
    const activateLiquidityXpath = buildDataTestIdXpath("deactivate");
    await clickElement(this.driver, activateLiquidityXpath);
  }

  async clickConfirmFeeAmount() {
    const submitSwapXpath = buildDataTestIdXpath("confirm-fee-amount");
    await clickElement(this.driver, submitSwapXpath);
  }

  async searchPoolToken(tokenName: string) {
    const searchButtonXpath = buildDataTestIdXpath("search-toggle");
    await clickElement(this.driver, searchButtonXpath);
    const searchInputXpath = buildDataTestIdXpath("search-input");
    const searchingLine = await this.driver.findElement(
      By.xpath(searchInputXpath),
    );
    await searchingLine.clear();
    await searchingLine.sendKeys(tokenName);
  }

  async closeSearchingBar() {
    const searchInputXpath = buildDataTestIdXpath("search-input");
    await this.driver.findElement(By.xpath(searchInputXpath));
    const closeButtonXpath = buildDataTestIdXpath("search-toggle");
    await clickElement(this.driver, closeButtonXpath);
  }

  async clickAddLiquidity() {
    const itemXpath = buildDataTestIdXpath(BUTTON_ADD_LIQ);
    await clickElement(this.driver, itemXpath);
  }

  async isFirstTokenNameSet(name: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) + buildXpathByText(name);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async setSecondTokenAmount(amount: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    await clickElement(this.driver, itemXpath);
    await writeText(this.driver, itemXpath, amount);
  }

  async setFirstTokenAmount(amount: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    await clickElement(this.driver, itemXpath);
    await writeText(this.driver, itemXpath, amount);
  }

  async isSecondTokenNameSet(name: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) + buildXpathByText(name);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async waitSecondTokenAmountSet(isSet: boolean, timeout = 5000) {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    await waitInputValueSetInterval(this.driver, itemXpath, isSet, timeout);
  }

  async waitFirstTokenAmountSet(isSet: boolean, timeout = 5000) {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    await waitInputValueSetInterval(this.driver, itemXpath, isSet, timeout);
  }

  async getFirstTokenAmount() {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    const text = await getAttribute(this.driver, itemXpath);
    const floatValue = parseFloat(text);
    return floatValue;
  }

  async waitForAddPoolFieldsVisible() {
    const firstItemXpath = buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER);
    const secondItemXpath = buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER);
    await waitForElementVisible(this.driver, firstItemXpath);
    await waitForElementEnabled(this.driver, firstItemXpath);
    await waitForElementEnabled(this.driver, secondItemXpath);
  }
}
