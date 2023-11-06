import { By, WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import {
  clickElement,
  doActionInDifferentWindow,
  waitForElement,
  waitForElementToDissapear,
} from "../utils/Helper";

const acc_name = "acc_automation";

//xpaths
const XPATH_PASSWORD = "//input[@name='password']";
const XPATH_NAME = "//input[@name='name']";
const XPATH_CONFIRM_PASSWORD = "//input[@name='passwordConfirm']";
const XPATH_BUTTON_SUBMIT = "//button[@type='submit']";
const XPATH_ACCEPT_PERMISSIONS = "//button[contains(., 'I agree')]";
const XPATH_BACKUP = "//button[contains(., 'Backup Now')]";
const XPATH_ALERT_POPUP = "//*[@role='alert']";
const XPATH_SECRET = "//div[contains(@class, 'secret')]";
const XPATH_WINDOW_ACCOUNT = `//span[contains(., '${acc_name}')]`;
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

export class Talisman {
  WEB_UI_ACCESS_URL = "chrome-extension://fijngjgcjhjmmpcmkeiomlglpeiijkld";

  driver: any;
  userPassword: string;

  constructor(driver: WebDriver) {
    this.driver = driver;
    const { uiUserPassword: userPassword } = getEnvironmentRequiredVars();
    this.userPassword = userPassword;
  }
  async go() {
    await this.driver.get(this.WEB_UI_ACCESS_URL);
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
    await clickElement(this.driver, XPATH_AVATAR);
    await clickElement(this.driver, XPATH_ACCOUNT);
    await clickElement(this.driver, XPATH_BUTTON_MORE);
    await clickElement(this.driver, XPATH_BUTTON_RENAME);

    await (
      await this.driver.findElement(By.xpath(XPATH_NAME))
    ).sendKeys(acc_name);

    await clickElement(this.driver, XPATH_MODAL_RENAME);
    await waitForElementToDissapear(this.driver, XPATH_MODAL_RENAME);
  }

  async getAccountMnemonic(): Promise<string> {
    await clickElement(this.driver, XPATH_BACKUP);
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(this.userPassword);
    await clickElement(this.driver, XPATH_BUTTON_SUBMIT);
    await waitForElement(this.driver, XPATH_SECRET, 13000);
    const element = await this.driver.findElement(By.xpath(XPATH_SECRET));
    const text = await element.getText();
    const phrases = text.split("\n").map((phrase: string) => phrase.trim());
    return phrases.join(" ");
  }

  async createAccount(): Promise<[string, string]> {
    await this.driver.get(
      `${this.WEB_UI_ACCESS_URL}/onboarding.html#/password`,
    );
    await this.fillUserPass();
    await clickElement(this.driver, XPATH_BUTTON_SUBMIT);
    await waitForElement(this.driver, XPATH_ACCEPT_PERMISSIONS, 3000);
    await clickElement(this.driver, XPATH_ACCEPT_PERMISSIONS);

    await waitForElement(this.driver, XPATH_ALERT_POPUP, 20000);
    await clickElement(this.driver, XPATH_ALERT_POPUP);

    const mnemonic = await this.getAccountMnemonic();

    await clickElement(this.driver, XPATH_MODAL_CLOSE);
    await this.renameAccount();
    await waitForElement(this.driver, XPATH_BACKUP, 3000);

    return ["todo-later", mnemonic];
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

  async acceptModal(driver: WebDriver) {
    await waitForElement(driver, XPATH_WINDOW_ACCOUNT);
    await clickElement(driver, XPATH_WINDOW_ACCOUNT);
    await clickElement(driver, XPATH_BUTTON_CONNECT);
  }
  async acceptPermissions() {
    await doActionInDifferentWindow(this.driver, this.acceptModal);
  }

  static getElementWithTextXpath(type: string, text: string) {
    return `//${type}[contains(., '${text}')]`;
  }
}
