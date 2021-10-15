import { By, WebDriver } from "selenium-webdriver";
import {
  buildDataTestIdXpath,
  clickElement,
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
}
