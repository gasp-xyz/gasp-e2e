import { By, until, WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import { clickElement, waitForElement } from "../utils/Helper";

//xpaths
const MSG_RECEIVE_TOKENS = `//div[text()='You will receive test tokens']`;
const LBL_YOUR_TOKENS = `//*[contains(text(),'Your tokens')]`;
const BTN_GET_TOKENS = `//button[contains(text(), 'Get Tokens')] `;
const DIV_ASSETS_ITEM = `//div[@class='assets']/div[@class='AssetBox']`
//const DIV_ASSETS_ITEM_VALUE = `${DIV_ASSETS_ITEM}/span[@class ='value']`
const DIV_MGA_ASSETS_ITEM_VALUE = `//div[@class = 'AssetBox' and //*[text()='MGA']]/span[@class='value']`
const DIV_MGA_SWAP = `//*[@class='Swap']`
const DIV_MGA_LOGO = `//*[contains(@class,'bg-mangata-logo')]`
const BTN_SELECT_TOKENS = `//*[text() = 'Select Token' ]`;
const LI_TOKEN_ELEM = `//*[@class = 'assets' ]/ul/li`;

const {uiUri} = getEnvironmentRequiredVars();

export class Mangata {

    driver: WebDriver;
    
    constructor(driver: WebDriver) {
        this.driver = driver;
    }

    async go(){
        await this.driver.get(uiUri);
    }
    async navigate(){
        await this.go();
        await waitForElement(this.driver, LBL_YOUR_TOKENS);
    }
    async isGetTokensVisible() {
        return await (await this.driver.findElement(By.xpath(MSG_RECEIVE_TOKENS))).isDisplayed()
    }
    async clickOnGetTokens() {
        await waitForElement(this.driver, BTN_GET_TOKENS);
        await clickElement(this.driver,BTN_GET_TOKENS);
    }
    async waitForFaucetToGenerateTokens(timeOut = 120000){
        await this.driver.wait(until.elementLocated(By.xpath(DIV_ASSETS_ITEM)),timeOut);
    }
    async getAssetValue(){
        await waitForElement(this.driver, DIV_MGA_ASSETS_ITEM_VALUE);
        const value = await (await this.driver.findElement(By.xpath(DIV_MGA_ASSETS_ITEM_VALUE))).getText();
        return value;
    }

    async isSwapFrameDisplayed() {
        return await (await this.driver.findElement(By.xpath(DIV_MGA_SWAP))).isDisplayed()
    }
    
    async isLogoDisplayed() {
        return await (await this.driver.findElement(By.xpath(DIV_MGA_LOGO))).isDisplayed()
    }
    async clickOnSelectTokens() {
        await clickElement(this.driver,BTN_SELECT_TOKENS);
    }
    async getAvailableTokenList() {
        const elements = await this.driver.findElements(By.xpath(LI_TOKEN_ELEM));
        const promises = elements.map( listItem => listItem.getText() );
        const tokenListTexts = await Promise.all(promises);
        return tokenListTexts;
    }

}