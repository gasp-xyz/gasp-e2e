import { WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import { Mangata } from "../pages/Mangata";
import { MetaMask } from "../pages/MetaMask";
import { Polkadot } from "../pages/Polkadot";
const fs = require('fs');

const { By, until } = require("selenium-webdriver");
require("chromedriver");

export async function waitForElement(driver: WebDriver, xpath : string){
    await driver.wait(until.elementLocated(By.xpath(xpath)),10000);
};

export async function clickElement(driver: WebDriver, xpath : string){
    await waitForElement(driver,xpath);
    const element = await driver.findElement(By.xpath(xpath));
    await driver.wait(until.elementIsVisible(element), 10000);
    await sleep(1000);
    await element.click();


}
///Setup both extensions
//Setup Metamask from "MNEMONIC_META" global env. 
//Polkadot extension creating an account.
export async function setupAllExtensions(driver: WebDriver){
    await leaveOnlyOneTab(driver);

    const metaMaskExtension = new MetaMask(driver);
    await metaMaskExtension.go();
    await metaMaskExtension.setupAccount();
    
    const polkadotExtension = new Polkadot(driver);
    await polkadotExtension.go();
    const polkUserAddress = await polkadotExtension.createAccount() ;

    await new Mangata(driver).go();
    await sleep(2000);
    await polkadotExtension.acceptPermissions();
    
    return {polkUserAddress: polkUserAddress}
    
}

export async function leaveOnlyOneTab(driver: WebDriver){
    let handles = await (await driver).getAllWindowHandles();
    for(let index = 1; index < handles.length; index++) {
        await (await driver).close();
        await (await driver).switchTo().window(handles[0]);
    }

}

export async function takeScreenshot(driver: WebDriver, testName = '') {
    const img = await driver.takeScreenshot();
    fs.writeFileSync(`reports/artifacts/screenshot_${testName}.png`, img, 'base64')
}

export async function getAccountJSON() {
    const path = 'utils/frontend/utils/extensions'
    const polkadotUserJson = `${path}/polkadotExportedUser.json`;
    const jsonContent =  JSON.parse(fs.readFileSync(polkadotUserJson,{encoding:'utf8', flag:'r'}));
    return jsonContent;
}