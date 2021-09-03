import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import {
  clickElement,
  doActionInDifferentWindow,
  waitForElement,
} from "../utils/Helper";
const { By } = require("selenium-webdriver");

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
const XPATH_CONNECT_META = `//button[text()='Connect']`;
const XPATH_NEXT = `//*[contains(@class,'button btn-primary')]`;
const { uiUserPassword: userPassword, mnemonicMetaMask } =
  getEnvironmentRequiredVars();

export class MetaMask {
  WEB_UI_ACCESS_URL =
    "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html";

  //TEST ACCOUNT
  ACCOUNT_MNEMONIC = mnemonicMetaMask;
  ACCOUNT_ADDRESS = "0x5cf5710342d514Fe5A0b61923a1e5c91B23FA0Ef";
  driver: any;

  constructor(driver: any) {
    this.driver = driver;
  }

  getAccountAddress() {
    return this.ACCOUNT_ADDRESS;
  }

  async go() {
    await this.driver.get(this.WEB_UI_ACCESS_URL);
  }

  async setupAccount() {
    await this.driver.get(
      `${this.WEB_UI_ACCESS_URL}#initialize/create-password/import-with-seed-phrase`
    );
    await waitForElement(this.driver, XPATH_MNEMONIC);
    await (await this.driver)
      .findElement(By.xpath(XPATH_MNEMONIC))
      .sendKeys(this.ACCOUNT_MNEMONIC);
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(userPassword);
    await (
      await this.driver.findElement(By.xpath(XPATH_CONFIRM_PASSWORD))
    ).sendKeys(userPassword);
    await clickElement(this.driver, XPATH_ACCEPT_TERMS);
    await clickElement(this.driver, XPATH_SUBMIT);
    await this.driver.get(`${this.WEB_UI_ACCESS_URL}#initialize/end-of-flow`);
    await waitForElement(this.driver, XPATH_ALL_DONE);
    await clickElement(this.driver, XPATH_ALL_DONE);
    await this.enable();
  }

  private async enable() {
    await waitForElement(this.driver, XPATH_POPOVER_CLOSE);
    await clickElement(this.driver, XPATH_POPOVER_CLOSE);
    await clickElement(this.driver, XPATH_SELECT_NET_CMB);
    await clickElement(this.driver, XPATH_KOVAN_NETWORK);
  }

  public async connect() {
    await clickElement(this.driver, XPATH_CONNECT_META);
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
