import { By, WebDriver } from "selenium-webdriver";
import { WithdrawModal } from "./WithdrawModal";

import {
  buildDataTestIdXpath,
  clickElement,
  waitForElement,
  waitForElementToDissapear,
} from "../utils/Helper";
import { FIVE_MIN } from "../../Constants";

const DIV_META_NOT_FOUND = "extensionMetamask-extensionNotFound";
const DIV_POLK_NOT_FOUND = "extensionPolkadot-extensionNotFound";
const BTN_INSTALL_META = "extensionMetamask-extensionNotFound-installBtn";
const BTN_INSTALL_POLK = "extensionPolkadot-extensionNotFound-installBtn";

const DOT_META_OK = "connect-metamaskGreenDot";
const BTN_META_DEPOSIT = "bridge-showDepositModalBtn";
const BTN_META_WITHDRAW = "bridge-showWithdrawModalBtn";

const DOT_POLK_OK = "connect-polkadotGreenDot";
const DIV_FAUCET_READY = "faucet-isReady-header";
const LBL_TOKEN_AMOUNT = "wallet-tokensAmount";

const SPINNER_LOADING = `//*[@class = 'Sidebar__loading']`;
export class Sidebar {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isConnectMetamaskVisible() {
    throw new Error("Method not implemented.");
  }
  async isPolkadotExtensionOK() {
    return await this.areVisible([
      DOT_POLK_OK,
      LBL_TOKEN_AMOUNT,
      DIV_FAUCET_READY,
    ]);
  }

  async isMetamaskExtensionOK() {
    return await this.areVisible([
      DOT_META_OK,
      BTN_META_DEPOSIT,
      BTN_META_WITHDRAW,
    ]);
  }

  async isMetamaskExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_META_NOT_FOUND);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }
  async isPolkExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_POLK_NOT_FOUND);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }

  async isMetamaskInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_META);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }
  async isPolkInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_POLK);
    const displayed = await this.isDisplayed(notInstalledXpath);
    return displayed;
  }

  async waitForLoad() {
    return new Promise<void>(async (resolve, reject) => {
      setTimeout(() => {
        reject("TIMEOUT: Waiting for " + SPINNER_LOADING + " to dissapear");
      }, 20000);
      await waitForElementToDissapear(this.driver, SPINNER_LOADING);
      resolve();
    });
  }

  async withdrawAllAssetsToMetaMask(tokenName: string) {
    await this.clickOnWithdrawToEth();
    const withdrawModal = new WithdrawModal(this.driver);
    await withdrawModal.selectToken(tokenName);
    await withdrawModal.selectMax();
    await withdrawModal.clickContinue();
    await withdrawModal.confirmAndSign();
  }
  async clickOnDepositToMangata() {
    const locator = buildDataTestIdXpath(BTN_META_DEPOSIT);
    await clickElement(this.driver, locator);
  }
  async clickOnWithdrawToEth() {
    const locator = buildDataTestIdXpath(BTN_META_WITHDRAW);
    await clickElement(this.driver, locator);
  }
  async waitForTokenToAppear(tokenName: string) {
    const xpath = buildDataTestIdXpath(
      this.buildTokenAvailableTestId(tokenName)
    );
    await waitForElement(this.driver, xpath, FIVE_MIN);
  }
  async getTokenAmount(tokenName: string) {
    await this.waitForTokenToAppear(tokenName);
    const tokenValueXpath = `//*[@data-testid='wallet-asset-${tokenName}']//span[@class='value']`;
    const value = await (
      await this.driver.findElement(By.xpath(tokenValueXpath))
    ).getText();
    return value;
  }
  async isLiquidityPoolVisible(asset1Name: string, asset2Name: string) {
    return await this.isDisplayed(
      buildDataTestIdXpath(this.buildPoolDataTestId(asset1Name, asset2Name))
    );
  }
  private buildPoolDataTestId(asseName1: string, assetName2: string) {
    return `poolsOverview-item-${asseName1}-${assetName2}`;
  }
  private buildTokenAvailableTestId(asseName1: string) {
    return `wallet-asset-${asseName1}`;
  }

  private async isDisplayed(elementXpath: string) {
    try {
      await waitForElement(this.driver, elementXpath, 2000);
      const displayed = await (
        await this.driver.findElement(By.xpath(elementXpath))
      ).isDisplayed();
      return displayed;
    } catch (Error) {
      return false;
    }
  }
  private async areVisible(listDataTestIds: string[]) {
    const promises: Promise<Boolean>[] = [];
    listDataTestIds.forEach((dataTestId) => {
      promises.push(this.isDisplayed(buildDataTestIdXpath(dataTestId)));
    });
    const allVisible = await Promise.all(promises);
    return allVisible.every((elem) => elem === true);
  }
}
