import { By, WebDriver } from "selenium-webdriver";
import { FIVE_MIN } from "../../Constants";
import { waitForNBlocks } from "../../utils";
import {
  buildDataTestIdXpath,
  buildXpathByElementText,
  clickElement,
  getText,
  waitForElement,
  waitForElementToDissapear,
  waitForElementVisible,
} from "../utils/Helper";

//SELECTORS
const MODAL_BASE = "transaction-modal";
const MODAL_CONFIRM_TRADE = "-confirming";
const MODAL_PROGRESS_TRADE = "-pending";
//transaction-modal-swap-pending
const MODAL_SUCCESS_TRADE = "-success";
const MODAL_ERROR = "-error";
const MODAL_DONE_BTN = "button";
const MODAL_TEXT = "-text";

export enum ModalType {
  Confirm,
  Progress,
  Success,
  Error,
  Rejected,
}

export enum TransactionType {
  Deposit,
  Swap,
  Withdraw,
  AddLiquidity,
  RemoveLiquidity,
  ActivateLiquidity,
  DeactivateLiquidity,
  CreatePool,
  Claim,
}

export class NotificationModal {
  driver: WebDriver;

  modalStage: Record<ModalType, string> = {
    [ModalType.Confirm]: MODAL_CONFIRM_TRADE,
    [ModalType.Progress]: MODAL_PROGRESS_TRADE,
    [ModalType.Success]: MODAL_SUCCESS_TRADE,
    [ModalType.Error]: MODAL_ERROR,
    [ModalType.Rejected]: MODAL_ERROR,
  };

  modalTransaction: Record<TransactionType, string> = {
    [TransactionType.Deposit]: "-deposit",
    [TransactionType.Withdraw]: "-withdraw",
    [TransactionType.AddLiquidity]: "-addLiquidity",
    [TransactionType.Swap]: "-swap",
    [TransactionType.ActivateLiquidity]: "-activateLP",
    [TransactionType.DeactivateLiquidity]: "-deactivateLP",
    [TransactionType.RemoveLiquidity]: "-removeLiquidity",
    [TransactionType.Claim]: "-claim",
    [TransactionType.CreatePool]: "-createPool",
  };

  constructor(driver: WebDriver) {
    this.driver = driver;
  }
  private getModalXpath(type: ModalType, transaction: TransactionType) {
    return buildDataTestIdXpath(
      MODAL_BASE + this.modalTransaction[transaction] + this.modalStage[type],
    );
  }
  private getModalTextXpath(type: ModalType) {
    return buildDataTestIdXpath(this.modalStage[type] + MODAL_TEXT);
  }

  public async isModalVisible(type: ModalType, transaction: TransactionType) {
    const modalXpath = this.getModalXpath(type, transaction);
    try {
      return await (
        await this.driver.findElement(By.xpath(modalXpath))
      ).isDisplayed();
    } catch (e) {
      return false;
    }
  }

  public async getModalText(type: ModalType, transaction: TransactionType) {
    const modalXpath = this.getModalXpath(type, transaction);
    return await getText(this.driver, modalXpath);
  }

  public async clickInDone() {
    await clickElement(
      this.driver,
      buildXpathByElementText(MODAL_DONE_BTN, "Confirm"),
    );
  }

  public async dismiss() {
    await clickElement(
      this.driver,
      buildXpathByElementText(MODAL_DONE_BTN, "close"),
    );
  }

  public async waitForModalDisappear(
    modalState: ModalType,
    transaction: TransactionType,
  ) {
    await waitForElementToDissapear(
      this.driver,
      this.getModalXpath(modalState, transaction),
    );
  }

  public async waitForModal(
    modalState: ModalType,
    transaction: TransactionType,
  ) {
    await waitForElement(
      this.driver,
      this.getModalXpath(modalState, transaction),
    );
    await waitForNBlocks(2);
  }

  public async waitForModalState(
    modalState: ModalType,
    transaction: TransactionType,
    timeout = FIVE_MIN,
  ) {
    await waitForElementVisible(
      this.driver,
      this.getModalXpath(modalState, transaction),
      timeout,
    );
  }

  async getModalErrorInfo(modalState: ModalType) {
    const locator = this.getModalTextXpath(modalState);
    const text = await getText(this.driver, locator);
    const [headerText, txInfo] = text.split("\n");

    return {
      //Confirm Trade in Polkadot extension\nSwapping 0.001 MGA for 0.000976 mETH'
      header: headerText,
      txInfo: txInfo,
      fromAmount: "",
      ToAmount: "",
      fromAsset: "",
      toAsset: "",
    };
  }
  async getModalInfo(modalState: ModalType) {
    const locator = this.getModalTextXpath(modalState);
    const text = await getText(this.driver, locator);
    const [headerText, txInfo] = text.split("\n");
    const regexfindValues = /([0-9]?.[0-9]+)\s/g;
    const amounts = txInfo.match(regexfindValues)!;
    const regexfindAssetNames = /[0-9]?.[0-9]+\s(?<AssetName>[a-zA-Z]+)/gm;
    const iterator = txInfo.matchAll(regexfindAssetNames);
    const assetNames: string[] = [];
    for (const match of iterator) {
      assetNames.push(match.groups!.AssetName);
    }

    return {
      //Confirm Trade in Polkadot extension\nSwapping 0.001 MGA for 0.000976 mETH'
      header: headerText,
      txInfo: txInfo,
      fromAmount: amounts[0].trim(),
      ToAmount: amounts[1].trim(),
      fromAsset: assetNames[0].trim(),
      toAsset: assetNames[1].trim(),
    };
  }
}
