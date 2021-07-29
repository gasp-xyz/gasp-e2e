import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars } from "../../utils";
import { clickElement, waitForElement } from "../utils/Helper";
const { By } = require("selenium-webdriver");

//xpaths
const XPATH_NEXT = "//*[text()='Next']";
const XPATH_PASSWORD = "//*[@type='password']";
const XPATH_CONFIRM_PASSWORD = "//*[@type='password' and @value='']";
const XPATH_MNEMONIC = `//*[contains(label/text(),'existing 12 or 24-word mnemonic seed')]/textarea`
const XPATH_USER_NAME = "//*[@type='text']";
const XPATH_ADD_ACCOUNT = "//*[text()='Add the account with the supplied seed']";
const XPATH_UNDERSTOOD = "//*[text()='Understood, let me continue']";
const XPATH_ACCEPT_PERMISSIONS = "//*[text()='Yes, allow this application access']";

const {uiUserPassword:userPassword, mnemonicPolkadot} = getEnvironmentRequiredVars();

export class Polkadot {

    WEB_UI_ACCESS_URL = 'chrome-extension://mopnmbcafieddcagagdcbnhejhlodfdd/index.html';

    //TEST ACCOUNT
    ACCOUNT_MNEMONIC = mnemonicPolkadot;
    ACCOUNT_ADDRESS = '5FvmNMFqpeM5wTiMTbhGsHxNjD37ndaLocE3bKNhf7LGgv1E'

    driver: any;

    constructor(driver: WebDriver) {
        this.driver = driver;
    }
    async go(){
        await this.driver.get(this.WEB_UI_ACCESS_URL);
    }
    
    getAccountAddress(){
        return this.ACCOUNT_ADDRESS;
    }

    async setupAccount(){
        await this.driver.get(`${this.WEB_UI_ACCESS_URL}#/account/import-seed`);
        await waitForElement(this.driver, XPATH_MNEMONIC);
        await (await this.driver).findElement(By.xpath(XPATH_MNEMONIC)).sendKeys(this.ACCOUNT_MNEMONIC);
        await clickElement(this.driver,XPATH_NEXT);

        await waitForElement(this.driver, XPATH_USER_NAME);
        await (await this.driver.findElement(By.xpath(XPATH_USER_NAME))).sendKeys('acc_automation');
        await (await this.driver.findElement(By.xpath(XPATH_PASSWORD))).sendKeys(userPassword);
        await (await this.driver.findElement(By.xpath(XPATH_CONFIRM_PASSWORD))).sendKeys(userPassword);
        await this.enable();
    }

    private async enable(){
        
        await waitForElement(this.driver, XPATH_ADD_ACCOUNT);
        await clickElement(this.driver,XPATH_ADD_ACCOUNT);

        await waitForElement(this.driver, XPATH_UNDERSTOOD);
        await clickElement(this.driver,XPATH_UNDERSTOOD);

    }

    async acceptPermissions(){
        let handle = await (await this.driver).getAllWindowHandles();
        let iterator = handle.entries();
        let value = iterator.next().value;
        while (value) {
            await this.driver.switchTo().window(value[1]);
            
            try {
                await waitForElement(this.driver,XPATH_ACCEPT_PERMISSIONS);
                await clickElement(this.driver,XPATH_ACCEPT_PERMISSIONS);
  
                break
            } catch (error) {
                
            }
            value = iterator.next().value;
            
        }
        handle = await (await this.driver).getAllWindowHandles();
        iterator = handle.entries();
        value = iterator.next().value;
        await this.driver.switchTo().window(value[1]); 
        return;
    }

}