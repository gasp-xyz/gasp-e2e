import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  getText,
  writeText,
} from "../utils/Helper";
import { Polkadot } from "./Polkadot";

//SELECTORS
const INPUT_PERCENTAGE = "removeLiquidityModal-amountCard-amountInput";
const BTN_PERCENTAGE_MAX =
  "removeLiquidityModal-amountCard-hardcodedAmountBtn-100";
const BTN_CONFIRM = "removeLiquidityModal-confirmBtn";

export class BrunLiquidityModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async getAssetAmount(assetName: string): Promise<string> {
    const xpath = `//*[contains(@data-testid,'removeLiquidityModal') and contains(@data-testId,'-rightColumn') and span[text() = '${assetName}'] ]/strong`;
    const text = await getText(this.driver, xpath);
    return text;
  }
  async setAmount(inputAmount: string) {
    const selector = buildDataTestIdXpath(INPUT_PERCENTAGE);
    await clickElement(this.driver, selector);
    await writeText(this.driver, selector, inputAmount);
  }
  async clickOn100Amount() {
    const selector = buildDataTestIdXpath(BTN_PERCENTAGE_MAX);
    await clickElement(this.driver, selector);
  }
  async confirm() {
    await clickElement(this.driver, buildDataTestIdXpath(BTN_CONFIRM));
  }
  async confirmAndSign() {
    await this.confirm();
    await Polkadot.signTransaction(this.driver);
  }
}
