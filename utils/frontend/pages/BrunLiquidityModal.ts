import { WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  getText,
  writeText,
} from "../utils/Helper";

//SELECTORS
const INPUT_PERCENTAGE = "removeLiquidityModal-amountCard-amountInput";

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
}
