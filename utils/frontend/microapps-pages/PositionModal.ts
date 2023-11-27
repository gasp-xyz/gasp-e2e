import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  buildHrefXpath,
  clickElement,
  waitForElementVisible,
} from "../utils/Helper";
import toNumber from "lodash-es/toNumber";

export class PositionModal {
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

  async isLiqPoolDisplayed(firstTokenName: string, secondTokenName: string) {
    const PoolName = "pool-" + firstTokenName + "-" + secondTokenName;
    const itemXpath = buildDataTestIdXpath(PoolName);
    const myPoolPosition = await this.driver.findElement(By.xpath(itemXpath));
    return myPoolPosition;
  }

  async isRewardHintDisplayed() {
    const itemXpath = buildDataTestIdXpath("reward-hint");
    const myPoolPosition = await this.driver.findElement(By.xpath(itemXpath));
    return myPoolPosition;
  }

  async clickPromPoolPosition(firstTokenName: string, secondTokenName: string) {
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
    const feeValueXpath = buildDataTestIdXpath("removing-fee-value");
    await waitForElementVisible(this.driver, feeValueXpath, 12000);
  }

  async clickRemoveLiquidity() {
    const submitSwapXpath = buildDataTestIdXpath("submitSwap");
    await clickElement(this.driver, submitSwapXpath);
  }

  async checkPromPoolPosition(firstTokenName: string, secondTokenName: string) {
    const PoolName = "pool-" + firstTokenName + "-" + secondTokenName;
    const poolNameXpath = buildDataTestIdXpath(PoolName);
    const activatedTokensXpath = buildDataTestIdXpath(
      "activated-LP-tokens-value",
    );
    const myPoolPosition = await this.driver
      .findElement(By.xpath(poolNameXpath))
      .findElement(By.xpath(activatedTokensXpath));
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
    const myPoolPosition = await this.driver
      .findElement(By.xpath(poolNameXpath))
      .findElement(By.xpath(activatedTokensXpath));
    const myPoolPositionText = await myPoolPosition.getText();
    const myPoolPositionNumber = myPoolPositionText.replace(",", "");
    const myPoolPositionValue = toNumber(myPoolPositionNumber);
    return myPoolPositionValue;
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
}
