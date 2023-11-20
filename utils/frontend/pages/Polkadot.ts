import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import {
  clickElement,
  doActionInDifferentWindow,
  waitForElement,
  writeText,
} from "../utils/Helper";
import { By } from "selenium-webdriver";

//xpaths
const XPATH_NEXT = "//*[text()='Next']";
const XPATH_PASSWORD = "//*[@type='password']";
const XPATH_CONFIRM_PASSWORD = "//*[@type='password' and @value='']";
const XPATH_MNEMONIC = `//*[contains(label/text(),'existing 12 or 24-word mnemonic seed')]/textarea`;
const XPATH_USER_NAME = "//*[@type='text']";
const XPATH_ADD_ACCOUNT = "//*[contains(text(),'Add the account with')]";
const XPATH_UNDERSTOOD = "//*[text()='Understood, let me continue']";
const XPATH_ACCEPT_PERMISSIONS =
  "//*[text()='Yes, allow this application access']";
const XPATH_CHECK_ISAVED = "//label[contains(text(),'I have saved')]";
const XPATH_NEXT_STEP = "//*[contains(text(),'Next step')]";
const XPATH_SETTINGS = "//div[@class='settings']";
const XPATH_EXPORT = "//a[text()='Export Account']";
const XPATH_EXPORT_CONFIRM = "//*[text()='I want to export this account']";
const XPATH_DATA_ADDRESS = "//*[@data-field = 'address']";
const XPATH_TEXT_AREA = "//textarea";
const XPATH_SIGN_PASSWORD = "//*[@type='password']";
const XPATH_SIGN_BTN = "//button[//div[text() = 'Sign the transaction']]";
const XPATH_CANCEL_BTN = "//*[contains(@class,'cancelButton')]/a";

export class Polkadot {
  WEB_UI_ACCESS_URL =
    "chrome-extension://mopnmbcafieddcagagdcbnhejhlodfdd/index.html";

  //TEST ACCOUNT

  ACCOUNT_ADDRESS = "5FvmNMFqpeM5wTiMTbhGsHxNjD37ndaLocE3bKNhf7LGgv1E";

  driver: any;
  userPassword: string;
  mnemonicPolkadot: string;

  constructor(driver: WebDriver) {
    this.driver = driver;
    const { uiUserPassword: userPassword, mnemonicPolkadot } =
      getEnvironmentRequiredVars();
    this.userPassword = userPassword;
    this.mnemonicPolkadot = mnemonicPolkadot;
  }
  async go() {
    await this.driver.get(this.WEB_UI_ACCESS_URL);
  }

  getAccountAddress() {
    return this.ACCOUNT_ADDRESS;
  }

  async setupAccount(mnemonicKeys = this.mnemonicPolkadot) {
    await this.driver.get(`${this.WEB_UI_ACCESS_URL}#/account/import-seed`);
    await waitForElement(this.driver, XPATH_MNEMONIC);
    await (await this.driver)
      .findElement(By.xpath(XPATH_MNEMONIC))
      .sendKeys(mnemonicKeys);
    await clickElement(this.driver, XPATH_NEXT);

    await this.fillUserPass();
    await this.enable();
  }
  private async fillUserPass(userNo: number = 0) {
    await waitForElement(this.driver, XPATH_USER_NAME);
    let name = "acc_automation";
    if (userNo > 0) {
      name += `_${userNo}`;
    }
    await (
      await this.driver.findElement(By.xpath(XPATH_USER_NAME))
    ).sendKeys(name);
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(this.userPassword);
    await (
      await this.driver.findElement(By.xpath(XPATH_CONFIRM_PASSWORD))
    ).sendKeys(this.userPassword);
  }

  async createAccount(userNo: number = 0): Promise<[string, string]> {
    await this.driver.get(`${this.WEB_UI_ACCESS_URL}#/account/create`);
    const accountAddress = await (
      await this.driver.findElement(By.xpath(XPATH_DATA_ADDRESS))
    ).getText();
    await clickElement(this.driver, XPATH_CHECK_ISAVED);
    const mnemonic = await (
      await this.driver.findElement(By.xpath(XPATH_TEXT_AREA))
    ).getText();
    await clickElement(this.driver, XPATH_NEXT_STEP);
    await this.fillUserPass(userNo);
    await this.enable(userNo === 0); //if first time --> we need to aknowlege.
    this.ACCOUNT_ADDRESS = accountAddress;
    return [accountAddress, mnemonic];
  }

  async exportAccount() {
    await clickElement(this.driver, XPATH_SETTINGS);
    await waitForElement(this.driver, XPATH_EXPORT);
    const linkToExport = await this.driver
      .findElement(By.xpath(XPATH_EXPORT))
      .getAttribute("href");
    await this.driver.get(`${linkToExport}`);
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(this.userPassword);
    await clickElement(this.driver, XPATH_EXPORT_CONFIRM);
  }

  private async enable(aknowledge: boolean = true): Promise<void> {
    await waitForElement(this.driver, XPATH_ADD_ACCOUNT);
    await clickElement(this.driver, XPATH_ADD_ACCOUNT);
    if (aknowledge) {
      await waitForElement(this.driver, XPATH_UNDERSTOOD);
      await clickElement(this.driver, XPATH_UNDERSTOOD);
      await waitForElement(this.driver, XPATH_DATA_ADDRESS);
    }
  }

  async acceptModal(driver: WebDriver) {
    await waitForElement(driver, XPATH_ACCEPT_PERMISSIONS);
    await clickElement(driver, XPATH_ACCEPT_PERMISSIONS);
  }
  async acceptPermissions() {
    await doActionInDifferentWindow(this.driver, this.acceptModal);
  }

  private static async signTransactionModal(driver: WebDriver) {
    const { uiUserPassword: userPassword } = getEnvironmentRequiredVars();
    await writeText(driver, XPATH_SIGN_PASSWORD, userPassword);
    await clickElement(driver, XPATH_SIGN_BTN);
  }
  private static async cancelOperationModal(driver: WebDriver) {
    const { uiUserPassword: userPassword } = getEnvironmentRequiredVars();
    await writeText(driver, XPATH_SIGN_PASSWORD, userPassword);
    await clickElement(driver, XPATH_CANCEL_BTN);
  }

  static async signTransaction(driver: WebDriver) {
    await doActionInDifferentWindow(driver, Polkadot.signTransactionModal);
    return;
  }
  static async cancelOperation(driver: WebDriver) {
    await doActionInDifferentWindow(driver, Polkadot.cancelOperationModal);
    return;
  }
  async hideAccount(userAddress: string) {
    const eyeIconXpath = `//div[div[text()='${userAddress}']]//*[@data-icon='eye']`;
    await clickElement(this.driver, eyeIconXpath);
    return;
  }
  async unHideAccount(userAddress: string) {
    const eyeIconXpath = `//div[div[text()='${userAddress}']]//*[@data-icon='eye-slash']`;
    await clickElement(this.driver, eyeIconXpath);
    return;
  }
}
