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
const TOAST_BASE = "tx-notification";
const TOAST_CONFIRM_TRADE = "-confirming";
const TOAST_PROGRESS_TRADE = "-pending";
//transaction-toast-swap-pending
const TOAST_SUCCESS_TRADE = "-success";
const TOAST_ERROR = "-error";
const TOAST_DONE_BTN = "button";
const TOAST_TEXT = "-text";

export enum ToastType {
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
  Stake,
  ApproveContract,
}

export class NotificationToast {
  driver: WebDriver;

  toastStage: Record<ToastType, string> = {
    [ToastType.Confirm]: TOAST_CONFIRM_TRADE,
    [ToastType.Progress]: TOAST_PROGRESS_TRADE,
    [ToastType.Success]: TOAST_SUCCESS_TRADE,
    [ToastType.Error]: TOAST_ERROR,
    [ToastType.Rejected]: TOAST_ERROR,
  };

  toastTransaction: Record<TransactionType, string> = {
    [TransactionType.Deposit]: "-rollupDeposit",
    [TransactionType.Withdraw]: "-rollupWithdrawal",
    [TransactionType.AddLiquidity]: "-addLiquidity",
    [TransactionType.Swap]: "-swap",
    [TransactionType.ActivateLiquidity]: "-activateLP",
    [TransactionType.DeactivateLiquidity]: "-deactivateLP",
    [TransactionType.RemoveLiquidity]: "-removeLiquidity",
    [TransactionType.Claim]: "-claim",
    [TransactionType.CreatePool]: "-createPool",
    [TransactionType.Stake]: "-stake",
    [TransactionType.ApproveContract]: "-approveContract",
  };

  constructor(driver: WebDriver) {
    this.driver = driver;
  }
  private gettoastXpath(type: ToastType, transaction: TransactionType) {
    return buildDataTestIdXpath(
      TOAST_BASE + this.toastTransaction[transaction] + this.toastStage[type],
    );
  }
  private gettoastTextXpath(type: ToastType) {
    return buildDataTestIdXpath(this.toastStage[type] + TOAST_TEXT);
  }

  public async istoastVisible(type: ToastType, transaction: TransactionType) {
    const toastXpath = this.gettoastXpath(type, transaction);
    try {
      return await (
        await this.driver.findElement(By.xpath(toastXpath))
      ).isDisplayed();
    } catch (e) {
      return false;
    }
  }

  public async gettoastText(type: ToastType, transaction: TransactionType) {
    const toastXpath = this.gettoastXpath(type, transaction);
    return await getText(this.driver, toastXpath);
  }

  public async clickInDone() {
    await clickElement(
      this.driver,
      buildXpathByElementText(TOAST_DONE_BTN, "Confirm"),
    );
  }

  public async dismiss() {
    await clickElement(
      this.driver,
      buildXpathByElementText(TOAST_DONE_BTN, "close"),
    );
  }

  public async waitForToastDisappear(
    toastState: ToastType,
    transaction: TransactionType,
  ) {
    await waitForElementToDissapear(
      this.driver,
      this.gettoastXpath(toastState, transaction),
    );
  }

  public async waitForToast(
    toastState: ToastType,
    transaction: TransactionType,
  ) {
    await waitForElement(
      this.driver,
      this.gettoastXpath(toastState, transaction),
    );
    await waitForNBlocks(2);
  }

  public async waitForToastState(
    toastState: ToastType,
    transaction: TransactionType,
    timeout = FIVE_MIN,
  ) {
    await waitForElementVisible(
      this.driver,
      this.gettoastXpath(toastState, transaction),
      timeout,
    );
  }

  async gettoastErrorInfo(toastState: ToastType) {
    const locator = this.gettoastTextXpath(toastState);
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
  async gettoastInfo(toastState: ToastType) {
    const locator = this.gettoastTextXpath(toastState);
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
