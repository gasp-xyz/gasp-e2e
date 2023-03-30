import { until, WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import {
  clickElement,
  doActionInDifferentWindow,
  waitForElement,
} from "../utils/Helper";
const { By } = require("selenium-webdriver");

//xpaths
const XPATH_NEXT = "//*[text()='Next']";
const XPATH_PASSWORD = "//input[@name='password']";
const XPATH_NAME = "//input[@name='name']";
const XPATH_CONFIRM_PASSWORD = "//input[@name='passwordConfirm']";
const XPATH_MNEMONIC = `//*[contains(label/text(),'existing 12 or 24-word mnemonic seed')]/textarea`;
const XPATH_BUTTON_SUBMIT = "//button[@type='submit']";
const XPATH_ADD_ACCOUNT = "//*[contains(text(),'Add the account with')]";
const XPATH_UNDERSTOOD = "//*[text()='Understood, let me continue']";
const XPATH_ACCEPT_PERMISSIONS = "//button[contains(., 'I agree')]";
const XPATH_BACKUP = "//button[contains(., 'Backup Now')]";
const XPATH_ALERT_POPUP = "//*[@role='alert']";
const XPATH_SECRET = "//div[contains(@class, 'secret')]";
const XPATH_WINDOW_ACCOUNT = "//span[contains(., 'acc_automation')]";
const XPATH_BUTTON_CONNECT = "//button[contains(., 'Connect')]";
const XPATH_BUTTON_MORE = "//span[contains(@class, 'icon more')]";
const XPATH_BUTTON_RENAME = "//button[contains(., 'Rename')]";
const XPATH_MODAL_CLOSE =
  "//*[contains(@class, 'modal-dialog')]//*[@class='close']";
const XPATH_MODAL_RENAME =
  "//*[contains(@class, 'modal-dialog')]//button[contains(., 'Rename')]";
const XPATH_AVATAR = "//div[contains(@class,'ao-avatar')]";
const XPATH_ACCOUNT =
  "//div[contains(@class,'ao-rows') and contains(.,'Polkadot')]";
const XPATH_SETTINGS = "//div[@class='settings']";
const XPATH_EXPORT = "//a[text()='Export Account']";
const XPATH_EXPORT_CONFIRM = "//*[text()='I want to export this account']";
const XPATH_DATA_ADDRESS = "//*[@data-field = 'address']";

export class Talisman {
  WEB_UI_ACCESS_URL = "chrome-extension://fijngjgcjhjmmpcmkeiomlglpeiijkld";

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

  async setupAccount() {
    await this.driver.get(`${this.WEB_UI_ACCESS_URL}#/account/import-seed`);
    await waitForElement(this.driver, XPATH_MNEMONIC);
    await (await this.driver)
      .findElement(By.xpath(XPATH_MNEMONIC))
      .sendKeys(this.mnemonicPolkadot);
    await clickElement(this.driver, XPATH_NEXT);

    await this.fillUserPass();
    await this.enable();
  }
  private async fillUserPass() {
    await waitForElement(this.driver, XPATH_PASSWORD);
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(this.userPassword);
    await (
      await this.driver.findElement(By.xpath(XPATH_CONFIRM_PASSWORD))
    ).sendKeys(this.userPassword);
  }

  private async renameAccount() {
    const name = "acc_automation";
    await clickElement(this.driver, XPATH_AVATAR);
    await clickElement(this.driver, XPATH_ACCOUNT);
    await clickElement(this.driver, XPATH_BUTTON_MORE);
    await clickElement(this.driver, XPATH_BUTTON_RENAME);

    await (await this.driver.findElement(By.xpath(XPATH_NAME))).sendKeys(name);

    await clickElement(this.driver, XPATH_MODAL_RENAME);
  }

  async createAccount(): Promise<[string, string]> {
    await this.driver.get(
      `${this.WEB_UI_ACCESS_URL}/onboarding.html#/password`
    );
    await this.fillUserPass();
    await clickElement(this.driver, XPATH_BUTTON_SUBMIT);
    await waitForElement(this.driver, XPATH_ACCEPT_PERMISSIONS, 3000);
    await clickElement(this.driver, XPATH_ACCEPT_PERMISSIONS);

    const urlToWaitFor = `${this.WEB_UI_ACCESS_URL}/dashboard.html#/portfolio`;
    await this.driver.wait(until.urlIs(urlToWaitFor), 5000);

    await clickElement(this.driver, XPATH_ALERT_POPUP);
    await clickElement(this.driver, XPATH_BACKUP);
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(this.userPassword);
    await clickElement(this.driver, XPATH_BUTTON_SUBMIT);

    await waitForElement(this.driver, XPATH_SECRET, 3000);
    const element = await this.driver.findElement(By.xpath(XPATH_SECRET));
    const text = await element.getText();
    const phrases = text.split("\n").map((phrase: string) => phrase.trim());
    const mnemonic = phrases.join(" ");

    await clickElement(this.driver, XPATH_MODAL_CLOSE);
    await this.renameAccount();
    await waitForElement(this.driver, XPATH_BACKUP, 3000);

    return ["todo-later", mnemonic];
  }

  async getClipboardText(driver: WebDriver): Promise<string> {
    const clipboardText = await driver.executeScript<string>(
      "return navigator.clipboard.readText();"
    );

    return clipboardText;
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
    await waitForElement(driver, XPATH_WINDOW_ACCOUNT);
    await clickElement(driver, XPATH_WINDOW_ACCOUNT);
    await clickElement(driver, XPATH_BUTTON_CONNECT);
  }
  async acceptPermissions() {
    await doActionInDifferentWindow(this.driver, this.acceptModal);
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
