import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import {
  appendText,
  buildDataTestIdXpath,
  clearTextManual,
  clickElement,
  isDisplayed,
  scrollIntoView,
  waitForElement,
  waitForElementVisible,
  writeText,
} from "../utils/Helper";

//locators
const IMPUT_MNEMONIC_FIELD = "import-srp__srp-word-";
const BTN_IMPORT_SUBMIT = "import-srp-confirm";
const INPUT_PASS_NEW = "create-password-new";
const INPUT_PASS_CONFIRM = "create-password-confirm";
const CHECKBOX_PASS_TERMS = "create-password-terms";
const BTN_CREATE_PASS_SUBMIT = "create-password-wallet";
const BTN_SECURE_LATER = "secure-wallet-later";
const CHECKBOX_SECURE_LATER = "skip-srp-backup-popover-checkbox";
const BTN_SKIP_SRP = "skip-srp-backup";
const BTN_IMPORT_DONE = "onboarding-complete-done";
const BTN_PIN_EXT_NEXT = "pin-extension-next";
const BTN_PIN_EXT_DONE = "pin-extension-done";
const CHECKBOX_TERMS_POPOVER = "terms-of-use-checkbox";
const BTN_TERMS_POPOVER_ACCEPT = "terms-of-use-accept-button";
const BTN_ACCOUNT_OPTIONS = "account-options-menu-button";
const BTN_ACCOUNT_DETAILS = "account-list-menu-details";
const BTN_ACCOUNT_LABEL = "editable-label-button";
const DIV_ACCOUNT_LABEL_INPUT = "editable-input";

export class MetaMask {
  WEB_UI_ACCESS_URL =
    "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html";

  driver: any;
  userPassword: string;
  mnemonicMetaMask: string;
  acc_name: string;

  constructor(driver: WebDriver) {
    this.driver = driver;
    const { uiUserPassword: userPassword, mnemonicMetaMask } =
      getEnvironmentRequiredVars();
    this.userPassword = userPassword;
    this.mnemonicMetaMask = mnemonicMetaMask;
    this.acc_name = "acc_automation";
  }
  async go() {
    await this.driver.get(this.WEB_UI_ACCESS_URL);
  }

  async setupAccount(mnemonicKeys = this.mnemonicMetaMask) {
    await this.driver.get(
      `${this.WEB_UI_ACCESS_URL}#onboarding/import-with-recovery-phrase`,
    );

    const XPATH_FIRST_WORD = buildDataTestIdXpath(IMPUT_MNEMONIC_FIELD + 0);
    await waitForElement(this.driver, XPATH_FIRST_WORD);
    await this.fillPassPhrase(mnemonicKeys);

    const XPATH_IMPORT_SUBMIT = buildDataTestIdXpath(BTN_IMPORT_SUBMIT);
    await clickElement(this.driver, XPATH_IMPORT_SUBMIT);

    await this.fillUserPass();

    const XPATH_PASS_TERMS = buildDataTestIdXpath(CHECKBOX_PASS_TERMS);
    await clickElement(this.driver, XPATH_PASS_TERMS);

    const XPATH_CREATE_PASS_SUBMIT = buildDataTestIdXpath(
      BTN_CREATE_PASS_SUBMIT,
    );
    await clickElement(this.driver, XPATH_CREATE_PASS_SUBMIT);

    const XPATH_BTN_SECURE_LATER = buildDataTestIdXpath(BTN_SECURE_LATER);
    if (await isDisplayed(this.driver, XPATH_BTN_SECURE_LATER)) {
      await this.skipBackup();
    }

    const XPATH_BTN_IMPORT_DONE = buildDataTestIdXpath(BTN_IMPORT_DONE);
    await clickElement(this.driver, XPATH_BTN_IMPORT_DONE);
    const XPATH_BTN_PIN_EXT_NEXT = buildDataTestIdXpath(BTN_PIN_EXT_NEXT);
    await clickElement(this.driver, XPATH_BTN_PIN_EXT_NEXT);
    const XPATH_BTN_PIN_EXT_DONE = buildDataTestIdXpath(BTN_PIN_EXT_DONE);
    await clickElement(this.driver, XPATH_BTN_PIN_EXT_DONE);

    await this.acceptTNC();
    await this.skipPopup();

    await this.changeAccountName(this.acc_name);
  }

  async fillPassPhrase(phrase: string) {
    const words = phrase.split(" ");
    for (let i = 0; i < words.length; i++) {
      const xpath = buildDataTestIdXpath(IMPUT_MNEMONIC_FIELD + i);
      await writeText(this.driver, xpath, words[i]);
    }
  }

  async changeAccountName(accountName: string) {
    const XPATH_BTN_ACCOUNT_OPTIONS = buildDataTestIdXpath(BTN_ACCOUNT_OPTIONS);
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_OPTIONS);
    const XPATH_BTN_ACCOUNT_DETAILS = buildDataTestIdXpath(BTN_ACCOUNT_DETAILS);
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_DETAILS);
    const XPATH_BTN_ACCOUNT_LABEL = buildDataTestIdXpath(BTN_ACCOUNT_LABEL);
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_LABEL);
    const XPATH_DIV_ACCOUNT_LABEL_INPUT =
      buildDataTestIdXpath(DIV_ACCOUNT_LABEL_INPUT) + "//input";
    await clearTextManual(this.driver, XPATH_DIV_ACCOUNT_LABEL_INPUT);
    await appendText(this.driver, XPATH_DIV_ACCOUNT_LABEL_INPUT, accountName);
    const XPATH_BTN_ACCOUNT_LABEL_CONFIRM =
      "//*[contains(@style, 'check.svg')]";
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_LABEL_CONFIRM);
  }

  async fillUserPass() {
    const XPATH_PASS_NEW = buildDataTestIdXpath(INPUT_PASS_NEW);
    const XPATH_PASS_CONFIRM = buildDataTestIdXpath(INPUT_PASS_CONFIRM);
    await writeText(this.driver, XPATH_PASS_NEW, this.userPassword);
    await writeText(this.driver, XPATH_PASS_CONFIRM, this.userPassword);
  }

  async skipBackup() {
    const XPATH_BTN_SECURE_LATER = buildDataTestIdXpath(BTN_SECURE_LATER);
    const XPATH_CHECKBOX_SECURE_LATER = buildDataTestIdXpath(
      CHECKBOX_SECURE_LATER,
    );
    const XPATH_BTN_SKIP_SRP = buildDataTestIdXpath(BTN_SKIP_SRP);
    await clickElement(this.driver, XPATH_BTN_SECURE_LATER);
    await clickElement(this.driver, XPATH_CHECKBOX_SECURE_LATER);
    await clickElement(this.driver, XPATH_BTN_SKIP_SRP);
  }

  async skipPopup() {
    const XPATH_DIV_POPOVER_CONTENT = "//*[@id='popover-content']";
    await waitForElementVisible(this.driver, XPATH_DIV_POPOVER_CONTENT);
    await this.driver.executeScript(
      "var element = document.getElementById('popover-content'); if(element) element.remove();",
    );
  }

  async acceptTNC() {
    const XPATH_CHECKBOX_TERMS_POPOVER = buildDataTestIdXpath(
      CHECKBOX_TERMS_POPOVER,
    );
    await scrollIntoView(this.driver, XPATH_CHECKBOX_TERMS_POPOVER);
    await clickElement(this.driver, XPATH_CHECKBOX_TERMS_POPOVER);
    const XPATH_BTN_TERMS_POPOVER_ACCEPT = buildDataTestIdXpath(
      BTN_TERMS_POPOVER_ACCEPT,
    );
    await clickElement(this.driver, XPATH_BTN_TERMS_POPOVER_ACCEPT);
  }
}
