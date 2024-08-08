import { By, WebDriver } from "selenium-webdriver";
import { FIVE_MIN } from "../../Constants";
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
const DEPOSIT_MODAL_CONTENT = "deposit-modal-content";
const BTN_CHAIN_SELECT = "chain-selector";
const CHAIN_SELECT_LIST = "chain-select-list";
const BTN_SELECT_TOKEN = "tokenInput-selector-btn";
const TOKEN_LIST = "tokenList";
const TOKEN_LIST_ITEM = "tokenList-item";
const TOKEN_TEXT_INPUT = "tokenInput-input";
const BTN_SUBMIT = "submit-deposit-button";
const ORIGIN_FEE = "origin-fee";
const DESTINATION_FEE = "destination-fee";
const FEE_VALUE = "fee-value";
const ERR_MESSAGE = "deposit-error-message";
const AMOUNT_FIELD = "AmountTooltip-anchor";
const CLOSE_MODAL = "deposit-modal-close";
const CONFIRMING_BLOCKING = "deposit-status-loading";
const SUCCESS_MODAL = "transfer-success";
const CLOSE_BUTTON = "close";

export enum DepositActionType {
  Deposit,
  Approve,
  Network,
  NetworkArbitrum,
  Approving,
  Done,
}

export class DepositModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  depositAction: Record<DepositActionType, string> = {
    [DepositActionType.Approve]: "Approve Deposit",
    [DepositActionType.Deposit]: "Deposit",
    [DepositActionType.Network]: "Switch to Holesky",
    [DepositActionType.NetworkArbitrum]: "Switch to Arbitrum",
    [DepositActionType.Approving]: "Enabling Deposit...",
    [DepositActionType.Done]: "Ok, I understand",
  };

  async isModalVisible() {
    const title = buildDataTestIdXpath(DEPOSIT_MODAL_CONTENT);
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

  async close() {
    await clickElement(this.driver, buildDataTestIdXpath(CLOSE_MODAL));
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

  async getTokenAmount() {
    const amountLocator =
      buildDataTestIdXpath(DEPOSIT_MODAL_CONTENT) +
      buildDataTestIdXpath(AMOUNT_FIELD);
    return await getText(this.driver, amountLocator);
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

  async waitForConfirmingVisible() {
    const xpath = buildDataTestIdXpath(CONFIRMING_BLOCKING);
    await waitForElementVisible(this.driver, xpath, 5000);
  }

  async waitForSuccessVisible() {
    const xpath = buildDataTestIdXpath(SUCCESS_MODAL);
    await waitForElementVisible(this.driver, xpath, 15000);
  }

  async closeSuccessModal() {
    const xpath = buildDataTestIdXpath(CLOSE_BUTTON);
    await clickElement(this.driver, xpath);
  }

  async clickContinue() {
    const continueBtn = buildDataTestIdXpath(BTN_SUBMIT);
    await clickElement(this.driver, continueBtn);
  }

  async clickDepositButtonByText(action: DepositActionType) {
    const xpath =
      buildDataTestIdXpath(DEPOSIT_MODAL_CONTENT) +
      buildXpathByElementText("button", this.depositAction[action]);
    await clickElement(this.driver, xpath);
  }

  async isContinueButtonEnabled() {
    const xpath = buildDataTestIdXpath(BTN_SUBMIT);
    return await (await this.driver.findElement(By.xpath(xpath))).isEnabled();
  }
  async isApproveButtonEnabled() {
    const xpath = buildXpathByElementText("button", "Approve Deposit");
    return await (await this.driver.findElement(By.xpath(xpath))).isEnabled();
  }

  async isNetworkButtonEnabled(action = DepositActionType.Network) {
    const xpath = buildXpathByElementText("button", this.depositAction[action]);
    return await (await this.driver.findElement(By.xpath(xpath))).isEnabled();
  }

  async waitTokenAmountChange(initValue: string, timeout = FIVE_MIN) {
    const startTime = Date.now();
    const endTime = startTime + timeout;

    while (Date.now() < endTime) {
      try {
        const tokenAmount = await this.getTokenAmount();
        if (tokenAmount !== initValue) {
          return;
        }
      } catch (error) {
        // Element not found or other error occurred, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      `Timeout: Element value not as desired after ${timeout} milliseconds`,
    );
  }
}
