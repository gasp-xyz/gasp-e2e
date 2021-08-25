import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import { clickElement, waitForElement } from "../utils/Helper";
const { By } = require("selenium-webdriver");

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

const { uiUserPassword: userPassword, mnemonicPolkadot } =
  getEnvironmentRequiredVars();

export class Polkadot {
  WEB_UI_ACCESS_URL =
    "chrome-extension://mopnmbcafieddcagagdcbnhejhlodfdd/index.html";

  //TEST ACCOUNT
  ACCOUNT_MNEMONIC = mnemonicPolkadot;
  ACCOUNT_ADDRESS = "5FvmNMFqpeM5wTiMTbhGsHxNjD37ndaLocE3bKNhf7LGgv1E";

  driver: any;

  constructor(driver: WebDriver) {
    this.driver = driver;
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
      .sendKeys(this.ACCOUNT_MNEMONIC);
    await clickElement(this.driver, XPATH_NEXT);

    await this.fillUserPass();
    await this.enable();
  }
  private async fillUserPass() {
    await waitForElement(this.driver, XPATH_USER_NAME);
    await (
      await this.driver.findElement(By.xpath(XPATH_USER_NAME))
    ).sendKeys("acc_automation");
    await (
      await this.driver.findElement(By.xpath(XPATH_PASSWORD))
    ).sendKeys(userPassword);
    await (
      await this.driver.findElement(By.xpath(XPATH_CONFIRM_PASSWORD))
    ).sendKeys(userPassword);
  }

  async createAccount(): Promise<[string, string]> {
    await this.driver.get(`${this.WEB_UI_ACCESS_URL}#/account/create`);
    await clickElement(this.driver, XPATH_CHECK_ISAVED);
    const mnemonic = await (
      await this.driver.findElement(By.xpath(XPATH_TEXT_AREA))
    ).getText();
    await clickElement(this.driver, XPATH_NEXT_STEP);
    await this.fillUserPass();
    const userAddress = await this.enable();
    this.ACCOUNT_ADDRESS = userAddress;
    return [userAddress, mnemonic];
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
    ).sendKeys(userPassword);
    await clickElement(this.driver, XPATH_EXPORT_CONFIRM);
  }

  private async enable(): Promise<string> {
    await waitForElement(this.driver, XPATH_ADD_ACCOUNT);
    await clickElement(this.driver, XPATH_ADD_ACCOUNT);

    await waitForElement(this.driver, XPATH_UNDERSTOOD);
    await clickElement(this.driver, XPATH_UNDERSTOOD);
    await waitForElement(this.driver, XPATH_DATA_ADDRESS);
    const accoundAddress = await (
      await this.driver.findElement(By.xpath(XPATH_DATA_ADDRESS))
    ).getText();
    return accoundAddress;
  }

  async acceptPermissions() {
    let handle = await (await this.driver).getAllWindowHandles();
    let iterator = handle.entries();
    let value = iterator.next().value;
    while (value) {
      await this.driver.switchTo().window(value[1]);

      try {
        await waitForElement(this.driver, XPATH_ACCEPT_PERMISSIONS);
        await clickElement(this.driver, XPATH_ACCEPT_PERMISSIONS);

        break;
      } catch (error) {}
      value = iterator.next().value;
    }
    handle = await (await this.driver).getAllWindowHandles();
    iterator = handle.entries();
    value = iterator.next().value;
    await this.driver.switchTo().window(value[1]);
    return;
  }
}
