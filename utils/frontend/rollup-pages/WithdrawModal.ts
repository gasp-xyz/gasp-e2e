import { By, WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import {
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByText,
  clickElement,
  getText,
  isDisplayed,
  waitForElementStateInterval,
  waitForElementVisible,
  writeText,
} from "../utils/Helper";

//SELECTORS
const WITHDRAW_MODAL_CONTENT = "withdrawal-modal-content";
const BTN_CHAIN_SELECT = "chain-selector";
const CHAIN_SELECT_LIST = "chain-select-list";
const BTN_SELECT_TOKEN = "tokenInput-selector-btn";
const TOKEN_LIST = "tokenList";
const TOKEN_LIST_ITEM = "tokenList-item";
const TOKEN_TEXT_INPUT = "tokenInput-input";
const BTN_SUBMIT = "submit-withdrawal-button";
const ORIGIN_FEE = "origin-fee";
const DESTINATION_FEE = "destination-fee";
const FEE_VALUE = "fee-value";
const ERR_MESSAGE = "withdrawal-error-message";
const CONFIRMING_BLOCKING = "withdraw-status-loading";
const SUCCESS_MODAL = "transfer-success";
const CLOSE_BUTTON = "close";

export enum WithdrawActionType {
  Withdraw,
  Network,
  NetworkArbitrum,
}

export class WithdrawModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  withdrawAction: Record<WithdrawActionType, string> = {
    [WithdrawActionType.Withdraw]: "Withdraw",
    [WithdrawActionType.Network]: "Switch to Holesky",
    [WithdrawActionType.NetworkArbitrum]: "Switch to Arbitrum",
  };

  async isModalVisible() {
    const title = buildDataTestIdXpath(WITHDRAW_MODAL_CONTENT);
    return isDisplayed(this.driver, title);
  }

  async isOriginFeeDisplayed() {
    const xpath =
      buildDataTestIdXpath(ORIGIN_FEE) + buildDataTestIdXpath(FEE_VALUE);
    return isDisplayed(this.driver, xpath);
  }

  async isDestinationFeeDisplayed() {
    const xpath =
      buildDataTestIdXpath(DESTINATION_FEE) + buildDataTestIdXpath(FEE_VALUE);
    return isDisplayed(this.driver, xpath);
  }

  async openChainList() {
    await clickElement(this.driver, buildDataTestIdXpath(BTN_CHAIN_SELECT));
  }

  async isErrorMessage() {
    const errMessageXpath = buildDataTestIdXpath(ERR_MESSAGE);
    return await isDisplayed(this.driver, errMessageXpath);
  }

  async selectChain(chainName: string) {
    await waitForElementVisible(
      this.driver,
      buildDataTestIdXpath(CHAIN_SELECT_LIST),
      5000,
    );
    const chainTestId = `${chainName}-chain`;
    const chainLocator = buildDataTestIdXpath(chainTestId);
    await sleep(1000);
    await waitForElementVisible(this.driver, chainLocator, 5000);
    await clickElement(this.driver, chainLocator);
  }

  async openTokensList() {
    await clickElement(this.driver, buildDataTestIdXpath(BTN_SELECT_TOKEN));
  }

  async selectToken(assetName: string) {
    //const tokenTestId = `tokenList-item`;
    const tokenLocator =
      buildDataTestIdXpath(TOKEN_LIST_ITEM) + buildXpathByText(assetName);
    await sleep(1000);
    await waitForElementVisible(this.driver, tokenLocator, 5000);
    await clickElement(this.driver, tokenLocator);
  }

  async getTokenAmount(assetName: string) {
    const assetTestId = `token-list-token-${assetName}-balance`;
    const assetLocator = buildDataTestIdXpath(assetTestId);
    return parseFloat(await getText(this.driver, assetLocator));
  }

  async waitForTokenListElementsVisible(assetName: string) {
    await waitForElementVisible(
      this.driver,
      buildDataTestIdXpath(TOKEN_LIST),
      5000,
    );
    const tokenTestId = `token-icon-${assetName}`;
    const tokenLocator = buildDataTestIdXpath(tokenTestId);
    await waitForElementVisible(this.driver, tokenLocator, 5000);
  }

  async enterValue(amount: string) {
    const inputTokenLocator = buildDataTestIdXpath(TOKEN_TEXT_INPUT);
    await clickElement(this.driver, inputTokenLocator);
    await writeText(this.driver, inputTokenLocator, amount);
  }

  async waitForContinueState(isEnabled: boolean, timeout: number) {
    const continueBtn = buildDataTestIdXpath(BTN_SUBMIT);
    await waitForElementStateInterval(
      this.driver,
      continueBtn,
      isEnabled,
      timeout,
    );
  }

  async clickContinue() {
    const continueBtn = buildDataTestIdXpath(BTN_SUBMIT);
    await clickElement(this.driver, continueBtn);
  }

  async isContinueButtonEnabled() {
    const xpath = buildDataTestIdXpath(BTN_SUBMIT);
    return await (await this.driver.findElement(By.xpath(xpath))).isEnabled();
  }

  async isNetworkButtonEnabled(action = WithdrawActionType.Network) {
    const xpath = buildXpathByElementText(
      "button",
      this.withdrawAction[action],
    );
    return await (await this.driver.findElement(By.xpath(xpath))).isEnabled();
  }

  async clickWithdrawButtonByText(action: WithdrawActionType) {
    const xpath =
      buildDataTestIdXpath(WITHDRAW_MODAL_CONTENT) +
      buildXpathByElementText("button", this.withdrawAction[action]);
    await clickElement(this.driver, xpath);
  }

  async waitForConfirmingVisible() {
    const xpath = buildDataTestIdXpath(CONFIRMING_BLOCKING);
    await waitForElementVisible(this.driver, xpath, 5000);
  }

  async waitForSuccessVisible() {
    const xpath = buildDataTestIdXpath(SUCCESS_MODAL);
    await waitForElementVisible(this.driver, xpath, 50000);
  }

  async closeSuccessModal() {
    const xpath = buildDataTestIdXpath(CLOSE_BUTTON);
    await clickElement(this.driver, xpath);
  }
}
