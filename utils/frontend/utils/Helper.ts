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

export async function setupAllExtensions(driver: WebDriver){
    await leaveOnlyOneTab(driver);

    const metaMaskExtension = new MetaMask(driver);
    await metaMaskExtension.go();
    await metaMaskExtension.setupAccount();
    
    const polkadotExtension = new Polkadot(driver);
    await polkadotExtension.go();
    await polkadotExtension.setupAccount();

    await new Mangata(driver).go();
    await sleep(2000);
    await polkadotExtension.acceptPermissions();
    
    
}

export async function leaveOnlyOneTab(driver: WebDriver){
    let handles = await (await driver).getAllWindowHandles();
    for(let index = 1; index < handles.length; index++) {
        await (await driver).close();
        await (await driver).switchTo().window(handles[0]);
    }

}

export async function takeScreenshot(driver: WebDriver) {
    const img = await driver.takeScreenshot()
    fs.writeFileSync('reports/out/screenshot.png', img, 'base64')
}