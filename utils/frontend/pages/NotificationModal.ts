import { info } from "console";
import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
  getText,
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
    return await (
      await this.driver.findElement(By.xpath(modalXpath))
    ).isDisplayed();
  }
  public async clickInDone() {
    await clickElement(this.driver, buildDataTestIdXpath(MODAL_DONE_BTN));
    await waitForElementToDissapear(
      this.driver,
      this.getModalXpath(ModalType.Success)
    );
  }
  async getModalInfo(modalState: ModalType) {
    const locator = this.getModalTextXpath(modalState);
    const text = await getText(this.driver, locator);
    const [headerText, txInfo] = text.split("\n");
    const regexfindValues = /([0-9]?.[0-9]+)/g;
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
      fromAmount: amounts[0],
      ToAmount: amounts[1],
      fromAsset: assetNames[0],
      toAsset: assetNames[1],
    };
  }
}
