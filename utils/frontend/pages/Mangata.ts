import { By, until, WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import { clickElement, waitForElement } from "../utils/Helper";

//xpaths
const MSG_RECEIVE_TOKENS = `//div[text()='You will receive test tokens']`;
const LBL_YOUR_TOKENS = `//*[contains(text(),'Your tokens')]`;
const BTN_GET_TOKENS = `//button[contains(text(), 'Get Tokens')] `;
const DIV_ASSETS_ITEM = `//div[@class='assets']/div[@class='AssetBox']`
//const DIV_ASSETS_ITEM_VALUE = `${DIV_ASSETS_ITEM}/span[@class ='value']`
const DIV_MGA_ASSETS_ITEM_VALUE = `//div[@class = 'AssetBox' and //*[text()='MNG']]/span[@class='value']`

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
    async waitForFaucetToGenerateTokens(timeOut = 90000){
        await this.driver.wait(until.elementLocated(By.xpath(DIV_ASSETS_ITEM)),timeOut);
    }
    async getAssetValue(){
        await waitForElement(this.driver, DIV_MGA_ASSETS_ITEM_VALUE);
        const value = await (await this.driver.findElement(By.xpath(DIV_MGA_ASSETS_ITEM_VALUE))).getText();
        return value;
    }
}