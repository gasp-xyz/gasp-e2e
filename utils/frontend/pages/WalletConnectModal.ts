import { By, WebDriver } from "selenium-webdriver";
import { areDisplayed, clickElement } from "../utils/Helper";

//SELECTORS
const MODAL_ROOT = "//*[@id='react-portal-modal-container']";
const MODAL_CONNECT = MODAL_ROOT + "//header[contains(.,'Connect wallet')]";
const MODAL_ACC_LIST =
  MODAL_ROOT + "//header[starts-with(.,'Select') and contains(.,'account')]";
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
    return await this.driver
      .findElement(By.xpath(this.modalStage[ModalType.Connect]))
      .isDisplayed();
  }

  async isReqExtensionInfoDisplayed(walletName: string) {
    const listDataTestIds = [
      this.modalStage[ModalType.NoExtension],
      this.getModalButtonXpath(ModalType.NoExtension, walletName),
    ];
    return await areDisplayed(this.driver, listDataTestIds);
  }

  async pickWallet(walletName: string) {
    await clickElement(
      this.driver,
      this.getModalButtonXpath(ModalType.Connect, walletName),
    );
  }

  async pickAccount(accountName: string) {
    await clickElement(
      this.driver,
      this.getModalButtonXpath(ModalType.AccountList, accountName),
    );
  }

  private getModalButtonXpath(type: ModalType, buttonString: string) {
    return this.modalStage[type] + `/..//button[contains(.,'${buttonString}')]`;
  }
}
