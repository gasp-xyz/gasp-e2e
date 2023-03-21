import { By, until, WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  clickElement,
  elementExistsNoError,
} from "../utils/Helper";

//SELECTORS
const MODAL_ROOT = "//*[@data-testid='selectAccountModal-bg']";
const MODAL_CONNECT = MODAL_ROOT + "//*[@data-testid='walletLoading']";
const MODAL_ACC_LIST = MODAL_ROOT + "//*[@data-testid='accountList']";
const MODAL_NO_EXT = MODAL_ROOT + "//header[contains(.,'got a wallet yet?')]";

export enum ModalType {
  Connect,
  AccountList,
  NoExtension,
}

export class WalletConnectModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  modalStage: Record<ModalType, string> = {
    [ModalType.Connect]: MODAL_CONNECT,
    [ModalType.AccountList]: MODAL_ACC_LIST,
    [ModalType.NoExtension]: MODAL_NO_EXT,
  };

  async opens() {
    const displayed = await this.driver
      .findElement(By.xpath(this.modalStage[ModalType.Connect]))
      .isDisplayed();
    return displayed;
  }

  async displayed() {
    const exists = await elementExistsNoError(
      this.driver,
      By.xpath(this.modalStage[ModalType.Connect])
    );
    if (exists) {
      const displayed = await this.driver
        .findElement(By.xpath(this.modalStage[ModalType.Connect]))
        .isDisplayed();
      return displayed;
    } else {
      return false;
    }
  }

  async accountsDisplayed() {
    await this.driver.wait(
      until.elementLocated(By.xpath(this.modalStage[ModalType.AccountList])),
      2000
    );
    const displayed = await this.driver
      .findElement(By.xpath(this.modalStage[ModalType.AccountList]))
      .isDisplayed();
    return displayed;
  }

  async isReqExtensionInfoDisplayed(walletName: string) {
    const listDataTestIds = [
      this.modalStage[ModalType.NoExtension],
      this.getAccountItemXpath(ModalType.NoExtension, walletName),
    ];
    const allVisible = await areDisplayed(this.driver, listDataTestIds);
    return allVisible;
  }

  async pickAccount(accountName: string) {
    await clickElement(
      this.driver,
      this.getAccountItemXpath(ModalType.AccountList, accountName)
    );
  }

  private getAccountItemXpath(type: ModalType, buttonString: string) {
    return (
      this.modalStage[type] +
      `//*[@data-testid="accountList-item" and contains(.,'${buttonString}')]`
    );
  }
}
