import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import {
  buildDataTestIdXpath,
  clickElement,
  doActionInDifferentWindow,
  getAttribute,
  waitForElement,
} from "../utils/Helper";
import { By } from "selenium-webdriver";

//xpaths
const XPATH_PASSWORD = "//input[@id='password']";
const XPATH_CONFIRM_PASSWORD = "//input[@id='confirm-password']";
const XPATH_ACCEPT_TERMS =
  "//*[contains(@class,'first-time-flow__checkbox first-time-flow__terms')]";
const XPATH_SUBMIT = "//button[contains(@type,'submit')]";
const XPATH_POPOVER_CLOSE = "//button[@data-testid='popover-close']";
const XPATH_SELECT_NET_CMB =
  "//*[@class='app-header__network-component-wrapper']//span[contains(@class,'box')]";
const XPATH_KOVAN_NETWORK = "//span[text()='Kovan Test Network']";
const XPATH_ALL_DONE =
  "//*[contains(@class,'button btn-primary first-time-flow__button')]";
const XPATH_MNEMONIC = `//input[@placeholder='Paste Secret Recovery Phrase from clipboard']`;
const TEST_ID_CONNECT_META = `extensionMetamask-accountNotFound-connectBtn`;
const XPATH_NEXT = `//*[contains(@class,'button btn-primary')]`;
const XPATH_ACCOUNT = `//*[@class='selected-account']`;
const XPATH_CONFIRM_TX = "//*[@data-testid='page-container-footer-next']";
const BTN_MENU_DOTS = "//*[@data-testid='account-options-menu-button']";
const SELECT_ACCOUNT_DETAILS =
  "//*[@data-testid='account-options-menu__account-details']";
const INPUT_READONLY = `//*[@class='readonly-input__input']`;
const BTN_CLOSE_MODAL = `//*[@class='account-modal__close']`;

export class MetaMask {
  async confirmAndSign(driver: WebDriver) {
    await clickElement(driver, XPATH_CONFIRM_TX);
  }
  async confirmTransaction() {
    await doActionInDifferentWindow(this.driver, this.confirmAndSign);
  }

  WEB_UI_ACCESS_URL =
    "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html";

  //TEST ACCOUNT
  ACCOUNT_ADDRESS = "0x5cf5710342d514Fe5A0b61923a1e5c91B23FA0Ef";
  driver: any;
  userPassword: string;
  mnemonicMetaMask: string;

  constructor(driver: any) {
    this.driver = driver;
    const { uiUserPassword: userPassword, mnemonicMetaMask } =
      getEnvironmentRequiredVars();
    this.userPassword = userPassword;
    this.mnemonicMetaMask = mnemonicMetaMask;
  }

  getAccountAddress() {
    return this.ACCOUNT_ADDRESS;
  }

  async go() {
    await this.driver.get(this.WEB_UI_ACCESS_URL);
  }

  async setupAccount() {
    await this.driver.get(
      `${this.WEB_UI_ACCESS_URL}#initialize/create-password/import-with-seed-phrase`,
    );
    await waitForElement(this.driver, XPATH_MNEMONIC);
    await (await this.driver)
      .findElement(By.xpath(XPATH_MNEMONIC))
      .sendKeys(this.mnemonicMetaMask);
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(this.userPassword);
    await (
      await this.driver.findElement(By.xpath(XPATH_CONFIRM_PASSWORD))
    ).sendKeys(this.userPassword);
    await clickElement(this.driver, XPATH_ACCEPT_TERMS);
    await clickElement(this.driver, XPATH_SUBMIT);
    await this.driver.get(`${this.WEB_UI_ACCESS_URL}#initialize/end-of-flow`);
    await waitForElement(this.driver, XPATH_ALL_DONE);
    await clickElement(this.driver, XPATH_ALL_DONE);
    return await this.enable();
  }

  private async enable() {
    await waitForElement(this.driver, XPATH_POPOVER_CLOSE);
    await clickElement(this.driver, XPATH_POPOVER_CLOSE);
    await clickElement(this.driver, XPATH_ACCOUNT);
    const address = await this.getAccountAddressFromUI();
    await clickElement(this.driver, XPATH_SELECT_NET_CMB);
    await clickElement(this.driver, XPATH_KOVAN_NETWORK);
    return address;
  }
  private async getAccountAddressFromUI() {
    await clickElement(this.driver, BTN_MENU_DOTS);
    await clickElement(this.driver, SELECT_ACCOUNT_DETAILS);
    const address = await getAttribute(this.driver, INPUT_READONLY);
    await clickElement(this.driver, BTN_CLOSE_MODAL);
    return address;
  }

  public async connect() {
    await sleep(4000);
    const xpath = buildDataTestIdXpath(TEST_ID_CONNECT_META);
    await clickElement(this.driver, xpath);
    await this.acceptConnectionPermissions();
  }

  async acceptConnection(driver: WebDriver) {
    await waitForElement(driver, XPATH_NEXT);
    await clickElement(driver, XPATH_NEXT);
    await sleep(2000);
    //now click on connect.
    await waitForElement(driver, XPATH_NEXT);
    await clickElement(driver, XPATH_NEXT);
  }
  async acceptConnectionPermissions() {
    //wait for window to be opened.
    await doActionInDifferentWindow(this.driver, this.acceptConnection);
    return;
  }
}
