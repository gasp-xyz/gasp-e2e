import { WithdrawModal } from "./WithdrawModal";
import { By, until, WebDriver } from "selenium-webdriver";
import { FIVE_MIN } from "../../Constants";
import { sleep } from "../../utils";
import {
  buildDataTestIdXpath,
  clickElement,
  getText,
  waitForElement,
  waitForElementToDissapear,
} from "../utils/Helper";
import { testLog } from "../../Logger";

const DIV_WALLET_NOT_FOUND = "connect-noWalletConnected";
const DIV_WALLET_CONNECTED = "connect-accountName";
const DIV_PROVIDED_LIQUIDITY_TITLE = "poolsOverview-title";
const WALLET_TOKENS_AMOUNT = "wallet-tokensAmount";

const DIV_META_NOT_FOUND = "extensionMetamask-extensionNotFound";
const DIV_POLK_NOT_FOUND = "extensionPolkadot-extensionNotFound";
const BTN_INSTALL_META = "extensionMetamask-extensionNotFound-installBtn";
const BTN_INSTALL_POLK = "extensionPolkadot-extensionNotFound-installBtn";

const DOT_META_OK = "connect-metamaskGreenDot";
const BTN_META_DEPOSIT = "bridge-showDepositModalBtn";
const BTN_META_WITHDRAW = "bridge-showWithdrawModalBtn";
const BTN_WITHDRAW = "bridge-showWithdrawModalBtn";

const DOT_POLK_OK = "connect-polkadotGreenDot";
const DIV_FAUCET_READY = "faucet-isReady-header";
const LBL_TOKEN_AMOUNT = "wallet-tokensAmount";

const SPINNER_LOADING = `//*[@class = 'Sidebar__loading']`;
const BTN_POOL_OVERVIEW = `poolsOverview-item-tkn1-tkn2`;
const BTN_REMOVE_LIQUIDITY = `poolDetail-removeBtn`;
const BTN_ADD_LIQUIDITY = `poolDetail-addBtn`;
const POOL_DETAIL_HEADER = `poolDetail-header`;
const LBL_TOKEN_NAME = "wallet-asset-tokenName";
const DIV_ASSETS_ITEM_VALUE = `//div[@class = 'AssetBox' and contains(@data-testid,'tokenName')]/*[@class='value']`;
const POLK_DIV_USER_NAME = `//div[@data-testid='connect-address']//div[@data-testid='undefined-trigger']/div`;
const BTN_CHANGE_PLK = `connect-changePolkadotAccount`;
const CLOSE_MODAL_BTN_XPATH = `//*[contains(@class,'AccountsModal__title--icon')]`;

export class Sidebar {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isNoWalletConnectedInfoDisplayed() {
    const noWalletConnectedXpath = buildDataTestIdXpath(DIV_WALLET_NOT_FOUND);
    return await this.isDisplayed(noWalletConnectedXpath);
  }

  async isWalletConnected(accountName: string) {
    const walletConnectedXpath = buildDataTestIdXpath(DIV_WALLET_CONNECTED);
    const actualAccount = await this.driver
      .findElement(By.xpath(walletConnectedXpath))
      ?.getText();
    return accountName === actualAccount;
  }

  async waitForWalletConnected() {
    const walletConnectedXpath = buildDataTestIdXpath(DIV_WALLET_CONNECTED);
    await waitForElement(this.driver, walletConnectedXpath);
  }

  async clickOnWalletConnect() {
    const locator = buildDataTestIdXpath(DIV_WALLET_NOT_FOUND);
    await clickElement(this.driver, locator);
  }

  async areSidebarElementsVisible() {
    return await this.areVisible([
      DIV_PROVIDED_LIQUIDITY_TITLE,
      WALLET_TOKENS_AMOUNT,
    ]);
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
    return await this.isDisplayed(notInstalledXpath);
  }

  async isPolkExtensionNotFoundDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(DIV_POLK_NOT_FOUND);
    return await this.isDisplayed(notInstalledXpath);
  }

  async isMetamaskInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_META);
    return await this.isDisplayed(notInstalledXpath);
  }
  async isPolkInstallBtnDisplayed() {
    const notInstalledXpath = buildDataTestIdXpath(BTN_INSTALL_POLK);
    return await this.isDisplayed(notInstalledXpath);
  }

  async waitForLoad(retry = 2): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      setTimeout(async () => {
        const visible = await this.isDisplayed(SPINNER_LOADING);
        if (visible) {
          if (retry > 0) {
            testLog.getLog().warn("Retrying wait for load: attempt " + retry);
            await this.driver.navigate().refresh();
            retry = retry - 1;
            return this.waitForLoad(retry);
          }
          reject("TIMEOUT: Waiting for " + SPINNER_LOADING + " to dissapear");
        } else {
          resolve();
        }
      }, 60000);
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
  async clickOnWithdraw() {
    const locator = buildDataTestIdXpath(BTN_WITHDRAW);
    await clickElement(this.driver, locator);
  }
  async clickOnWithdrawToEth() {
    const locator = buildDataTestIdXpath(BTN_META_WITHDRAW);
    await clickElement(this.driver, locator);
  }
  async waitForTokenToAppear(tokenName: string, timeout: number) {
    const xpath = buildDataTestIdXpath(
      this.buildTokenAvailableTestId(tokenName),
    );
    await waitForElement(this.driver, xpath, timeout);
  }
  async getTokenAmount(tokenName: string, timeout = FIVE_MIN) {
    await this.waitForTokenToAppear(tokenName, timeout);
    const tokenValueXpath = `//*[@data-testid='wallet-token-${tokenName}-balance']`;
    return await (
      await this.driver.findElement(By.xpath(tokenValueXpath))
    ).getText();
  }
  private buildTokenAvailableTestId(asseName1: string) {
    return `wallet-token-${asseName1}`;
  }

  private async isDisplayed(elementXpath: string) {
    try {
      await waitForElement(this.driver, elementXpath, 2000);
      return await (
        await this.driver.findElement(By.xpath(elementXpath))
      ).isDisplayed();
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
  async clickOnLiquidityPool(poolAsset1Name: string, poolAsset2Name: string) {
    let xpath = buildDataTestIdXpath(
      BTN_POOL_OVERVIEW.replace("tkn1", poolAsset1Name).replace(
        "tkn2",
        poolAsset2Name,
      ),
    );
    const displayed = await this.isDisplayed(xpath);
    if (!displayed) {
      //lets try in the other way around.
      xpath = buildDataTestIdXpath(
        BTN_POOL_OVERVIEW.replace("tkn1", poolAsset2Name).replace(
          "tkn2",
          poolAsset1Name,
        ),
      );
    }
    await clickElement(this.driver, xpath);
    await sleep(2000);
  }

  async clickOnRemoveLiquidity() {
    const xpath = buildDataTestIdXpath(BTN_REMOVE_LIQUIDITY);
    await clickElement(this.driver, xpath);
  }

  async clickOnAddLiquidity() {
    const xpath = buildDataTestIdXpath(BTN_ADD_LIQUIDITY);
    await clickElement(this.driver, xpath);
  }

  async waitUntilTokenAvailable(assetName: string, timeout = FIVE_MIN) {
    const xpath = buildDataTestIdXpath(
      LBL_TOKEN_NAME.replace("tokenName", assetName),
    );
    await this.driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
  }
  async getAssetValue(assetName: string) {
    const xpath = DIV_ASSETS_ITEM_VALUE.replace("tokenName", assetName);
    await waitForElement(this.driver, xpath);
    return await (await this.driver.findElement(By.xpath(xpath))).getText();
  }
  private buildPoolDataTestId(asseName1: string, assetName2: string) {
    return `poolsOverview-item-${asseName1}-${assetName2}`;
  }
  async isLiquidityPoolVisible(asset1Name: string, asset2Name: string) {
    const poolXpath = buildDataTestIdXpath(
      this.buildPoolDataTestId(asset1Name, asset2Name),
    );
    return await this.isDisplayed(poolXpath);
  }

  async waitForLiquidityPoolToLoad(asset1Name: string, asset2Name: string) {
    const poolXpath = buildDataTestIdXpath(
      this.buildPoolDataTestId(asset1Name, asset2Name),
    );
    await waitForElement(this.driver, poolXpath);
  }

  async isPoolDetailVisible() {
    return await this.isDisplayed(buildDataTestIdXpath(POOL_DETAIL_HEADER));
  }

  async clickLiquidityPool(asset1Name: string, asset2Name: string) {
    await clickElement(
      this.driver,
      buildDataTestIdXpath(this.buildPoolDataTestId(asset1Name, asset2Name)),
    );
  }

  async getAssetValueInvested(assetName: string) {
    const LBL_TOKEN_AMOUNT_INVESTED = `//*[contains(@data-testid,'poolDetail') and span[text()='${assetName}']]`;
    return await getText(this.driver, LBL_TOKEN_AMOUNT_INVESTED);
  }
  async waitForTokenToDissapear(assetName: string) {
    const xpath = buildDataTestIdXpath(
      LBL_TOKEN_NAME.replace("tokenName", assetName),
    );
    await waitForElementToDissapear(this.driver, xpath);
  }
  async getUserName() {
    await waitForElement(this.driver, POLK_DIV_USER_NAME);
    return await getText(this.driver, POLK_DIV_USER_NAME);
  }
  async switchAccountTo(userAddress: string) {
    //TODO: write the locatos here
    const listItemWithAddress = `//*[@data-testid='user-address-${userAddress}']`;
    const btnxpath = buildDataTestIdXpath(BTN_CHANGE_PLK);
    await clickElement(this.driver, btnxpath);
    await clickElement(this.driver, listItemWithAddress);
  }
  async getAvailableAccountsFromChangeModal(): Promise<string[]> {
    //user-address-5GFC5MEG6N3RKMG4sg42MPrvHWcTbEdtkXKB41nTkm3E7fNP
    const AllListItemsFromModal = `//*[contains(@data-testid, "user-address-")]`;
    const btnxpath = buildDataTestIdXpath(BTN_CHANGE_PLK);
    await clickElement(this.driver, btnxpath);
    const available = await this.driver.findElements(
      By.xpath(AllListItemsFromModal),
    );
    const items = [];
    for (let index = 0; index < available.length; index++) {
      const element = available[index];
      items.push(await element.getText());
    }
    await clickElement(this.driver, CLOSE_MODAL_BTN_XPATH);
    return items;
  }
  async copyAssetValue(assetName: string) {
    const xpath = DIV_ASSETS_ITEM_VALUE.replace("tokenName", assetName);
    await waitForElement(this.driver, xpath);
    const element = await this.driver.findElement(By.xpath(xpath));
    await this.driver.actions().mouseMove(element).perform();
    const assetDataTestId = `wallet-asset-${assetName}-balance-tooltip`;
    const xpathByDataTestId = buildDataTestIdXpath(assetDataTestId);
    const xpathToTooltipValue = `${xpathByDataTestId}//div[@class='TruncatedNumber__tooltip__value']`;
    return await getText(this.driver, xpathToTooltipValue);
  }
}
