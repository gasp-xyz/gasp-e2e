import {WebDriver} from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  selectAssetFromModalList,
  writeText,
} from "../utils/Helper";
import {MetaMask} from "./MetaMask";

//SELECTORS
const SELECT_TOKEN = "depositModal-step0-assetInput";
const STEP_O_CONT = "depositModal-step0-continueBtn";
const STEP_1_CONF = "depositModal-step1-confirmBtn";

export class DepositModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  private btnSelectTokenLocator =
    buildDataTestIdXpath(SELECT_TOKEN) + "//button";
  private inputTokenLocator = buildDataTestIdXpath(SELECT_TOKEN) + "//input";

  async selectToken(assetName: string) {
    await clickElement(this.driver, this.btnSelectTokenLocator);
    await selectAssetFromModalList(assetName, this.driver);
  }
  async enterValue(amount: string) {
    await clickElement(this.driver, this.inputTokenLocator);
    await writeText(this.driver, this.inputTokenLocator, amount);
  }
  async clickContinue() {
    const xpath = buildDataTestIdXpath(STEP_O_CONT);
    await clickElement(this.driver, xpath);
  }
  async confirmAndSign() {
    const xpath = buildDataTestIdXpath(STEP_1_CONF);
    await clickElement(this.driver, xpath);
    const meta = new MetaMask(this.driver);
    await meta.confirmTransaction();
  }
}
