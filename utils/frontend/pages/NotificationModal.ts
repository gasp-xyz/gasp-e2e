import { info } from "console";
import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  getText,
  waitForElement,
  waitForElementToDissapear,
} from "../utils/Helper";

//SELECTORS
const MODAL_CONFIRM_TRADE = "txProgressModal-step0-cardContent";
const MODAL_PROGRESS_TRADE = "txProgressModal-step1-cardContent";
const MODAL_SUCCESS_TRADE = "txProgressModal-step2-cardContent";
const MODAL_DONE_BTN = "txProgressModal-step2-doneBtn";
const MODAL_TEXT = "-text";

export enum ModalType {
  Confirm,
  Progress,
  Success,
}

export class NotificationModal {
  driver: WebDriver;

  modalStage: Record<ModalType, string> = {
    [ModalType.Confirm]: MODAL_CONFIRM_TRADE,
    [ModalType.Progress]: MODAL_PROGRESS_TRADE,
    [ModalType.Success]: MODAL_SUCCESS_TRADE,
  };

  constructor(driver: WebDriver) {
    this.driver = driver;
  }
  private getModalXpath(type: ModalType) {
    return buildDataTestIdXpath(this.modalStage[type]);
  }
  private getModalTextXpath(type: ModalType) {
    return buildDataTestIdXpath(this.modalStage[type] + MODAL_TEXT);
  }

  public async isModalVisible(type: ModalType) {
    const modalXpath = this.getModalXpath(type);
    try {
      return await (
        await this.driver.findElement(By.xpath(modalXpath))
      ).isDisplayed();
    } catch (e) {
      return false;
    }
  }
  public async clickInDone() {
    await clickElement(this.driver, buildDataTestIdXpath(MODAL_DONE_BTN));
    await waitForElementToDissapear(
      this.driver,
      this.getModalXpath(ModalType.Success)
    );
  }
  public async waitForModal(modalState: ModalType) {
    await waitForElement(this.driver, this.getModalXpath(modalState));
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
      txInfo: info,
      fromAmount: amounts[0].trim(),
      ToAmount: amounts[1].trim(),
      fromAsset: assetNames[0].trim(),
      toAsset: assetNames[1].trim(),
    };
  }
}
