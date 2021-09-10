import { WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import { Mangata } from "../pages/Mangata";
import { MetaMask } from "../pages/MetaMask";
import { Polkadot } from "../pages/Polkadot";
const fs = require("fs");

const { By, until } = require("selenium-webdriver");
require("chromedriver");

export async function waitForElement(
  driver: WebDriver,
  xpath: string,
  timeout = 10000
) {
  await driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
}

export async function waitForElementToDissapear(
  driver: WebDriver,
  xpath: string
) {
  let continueWaiting = false;
  do {
    try {
      await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
      continueWaiting = true;
    } catch (error) {
      sleep(1000);
      continueWaiting = false;
    }
  } while (continueWaiting);
}

export async function clickElement(driver: WebDriver, xpath: string) {
  await waitForElement(driver, xpath);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.wait(until.elementIsVisible(element), 10000);
  await sleep(1000);
  await element.click();
}

export async function writeText(
  driver: WebDriver,
  elementXpath: string,
  text: string
) {
  await waitForElement(driver, elementXpath);
  await (await driver.findElement(By.xpath(elementXpath))).clear();
  await (await driver.findElement(By.xpath(elementXpath))).sendKeys(text);
}
export async function getText(driver: WebDriver, elementXpath: string) {
  await waitForElement(driver, elementXpath);
  const text = await (
    await driver.findElement(By.xpath(elementXpath))
  ).getText();
  return text;
}

///Setup both extensions
//Setup Metamask from "MNEMONIC_META" global env.
//Polkadot extension creating an account.
export async function setupAllExtensions(driver: WebDriver) {
  await leaveOnlyOneTab(driver);

  const metaMaskExtension = new MetaMask(driver);
  await metaMaskExtension.go();
  await metaMaskExtension.setupAccount();

  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.go();
  const [polkUserAddress, usrMnemonic] =
    await polkadotExtension.createAccount();

  await new Mangata(driver).go();
  await sleep(2000);
  await polkadotExtension.acceptPermissions();

  await metaMaskExtension.connect();
  return { polkUserAddress: polkUserAddress, mnemonic: usrMnemonic };
}

export async function leaveOnlyOneTab(driver: WebDriver) {
  const handles = await (await driver).getAllWindowHandles();
  for (let index = 1; index < handles.length; index++) {
    await (await driver).close();
    await (await driver).switchTo().window(handles[0]);
  }
}

export async function takeScreenshot(driver: WebDriver, testName = "") {
  const img = await driver.takeScreenshot();
  fs.writeFileSync(
    `reports/artifacts/screenshot_${testName}.png`,
    img,
    "base64"
  );
}

export async function getAccountJSON() {
  const path = "utils/frontend/utils/extensions";
  const polkadotUserJson = `${path}/polkadotExportedUser.json`;
  const jsonContent = JSON.parse(
    fs.readFileSync(polkadotUserJson, { encoding: "utf8", flag: "r" })
  );
  return jsonContent;
}

export function buildDataTestIdSelector(dataTestId: string) {
  return By.xpath(buildDataTestIdXpath(dataTestId));
}

export function buildDataTestIdXpath(dataTestId: string) {
  const xpathSelector = `//*[@data-testid='${dataTestId}']`;
  return xpathSelector;
}

export async function doActionInDifferentWindow(
  driver: WebDriver,
  fn: (driver: WebDriver) => void
) {
  await sleep(4000);
  let handle = await (await driver).getAllWindowHandles();
  let iterator = handle.entries();
  let value = iterator.next().value;
  while (value) {
    await driver.switchTo().window(value[1]);

    try {
      await fn(driver);
      break;
    } catch (error) {}
    value = iterator.next().value;
  }
  handle = await (await driver).getAllWindowHandles();
  iterator = handle.entries();
  value = iterator.next().value;
  await driver.switchTo().window(value[1]);
  return;
}
