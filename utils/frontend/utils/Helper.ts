import { logging, WebDriver } from "selenium-webdriver";
import { sleep } from "../../utils";
import { Mangata } from "../pages/Mangata";
import { Polkadot } from "../pages/Polkadot";
import fs from "fs";
import { testLog } from "../../Logger";
import { BN } from "@polkadot/util";

import { Reporter } from "jest-allure/dist/Reporter";
const { By, until } = require("selenium-webdriver");

const timeOut = 60000;
require("chromedriver");
const outputPath = `reports/artifacts`;
export async function waitForElement(
  driver: WebDriver,
  xpath: string,
  timeout = timeOut
) {
  await driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
}

export async function waitForElementEnabled(
  driver: WebDriver,
  xpath: string,
  timeout = timeOut
) {
  await waitForElement(driver, xpath, timeout);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.wait(until.elementIsEnabled(element), timeout);
}

export async function waitForElementToDissapear(
  driver: WebDriver,
  xpath: string
) {
  let continueWaiting = false;
  do {
    try {
      await driver.wait(until.elementLocated(By.xpath(xpath)), 500);
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
  await driver.wait(until.elementIsVisible(element), timeOut);
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
  const input = await driver.findElement(By.xpath(elementXpath));
  await driver.executeScript("arguments[0].value = '';", input);
  await (await driver.findElement(By.xpath(elementXpath))).sendKeys(text);
}
export async function getText(driver: WebDriver, elementXpath: string) {
  await waitForElement(driver, elementXpath);
  const text = await (
    await driver.findElement(By.xpath(elementXpath))
  ).getText();
  return text;
}

export async function getAttribute(
  driver: WebDriver,
  elementXpath: string,
  attrName = "value"
) {
  await waitForElement(driver, elementXpath);
  const attr = await (
    await driver.findElement(By.xpath(elementXpath))
  ).getAttribute(attrName);
  return attr;
}

///Setup extensions
//Polkadot extension creating an account.
export async function setupAllExtensions(driver: WebDriver) {
  await leaveOnlyOneTab(driver);

  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.go();
  const [polkUserAddress, usrMnemonic] =
    await polkadotExtension.createAccount();

  await new Mangata(driver).go();
  await sleep(2000);
  await polkadotExtension.acceptPermissions();

  return {
    polkUserAddress: polkUserAddress,
    mnemonic: usrMnemonic,
  };
}

export async function setupPolkadotExtension(driver: WebDriver) {
  await leaveOnlyOneTab(driver);

  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.go();
  const [polkUserAddress, usrMnemonic] =
    await polkadotExtension.createAccount();

  await new Mangata(driver).go();
  await sleep(2000);

  return {
    polkUserAddress: polkUserAddress,
    mnemonic: usrMnemonic,
  };
}

export async function acceptPermissionsPolkadotExtension(driver: WebDriver) {
  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.go();
  await polkadotExtension.acceptPermissions();
}

export async function leaveOnlyOneTab(driver: WebDriver) {
  const handles = await (await driver).getAllWindowHandles();
  for (let index = 1; index < handles.length; index++) {
    await (await driver).close();
    await (await driver).switchTo().window(handles[0]);
  }
}

export async function isDisplayed(driver: WebDriver, elementXpath: string) {
  try {
    await waitForElement(driver, elementXpath, 2000);
    const displayed = await (
      await driver.findElement(By.xpath(elementXpath))
    ).isDisplayed();
    return displayed;
  } catch (Error) {
    return false;
  }
}

export async function areVisible(driver: WebDriver, listDataTestIds: string[]) {
  const promises: Promise<boolean>[] = listDataTestIds.map((dataTestId) =>
    isDisplayed(driver, dataTestId)
  );
  const allVisible = await Promise.all(promises);
  return allVisible.every((elem) => elem === true);
}

export async function addExtraLogs(driver: WebDriver, testName = "") {
  [logging.Type.BROWSER, logging.Type.DRIVER].forEach(async (value) => {
    await driver
      .manage()
      .logs()
      .get(value)
      .then(function (entries) {
        entries.forEach(function (entry) {
          const logLine = `[${entry.level.name}] ${entry.message}`;
          fs.appendFileSync(
            `${outputPath}/log_${value}_${testName}_${Date.now().toString()}.txt`,
            logLine + " \n"
          );
        });
      });
  });
  const img = await driver.takeScreenshot();
  fs.writeFileSync(`${outputPath}/screenshot_${testName}.png`, img, "base64");
  const reporter = (globalThis as any).reporter as Reporter;
  reporter.addAttachment("Screeenshot", new Buffer(img, "base64"), "image/png");
}
export async function renameExtraLogs(testName: string, result = "FAILED_") {
  fs.readdirSync(outputPath).forEach((file) => {
    if (file.includes(testName)) {
      testLog.getLog().info(`Renaming ${file} to ${result}${file}`);
      fs.renameSync(`${outputPath}/${file}`, `${outputPath}/${result}${file}`);
    }
  });
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
  let iterator = handle.reverse().entries();

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
  testLog.getLog().info("Windows:" + JSON.stringify(handle));
  await driver.switchTo().window(value[1]);
  return;
}

export async function selectAssetFromModalList(
  assetName: string,
  driver: WebDriver
) {
  const assetTestId = `TokensModal-asset-${assetName}`;
  const assetLocator = buildDataTestIdXpath(assetTestId);
  await clickElement(driver, assetLocator);
}

export function uiStringToBN(stringValue: string) {
  if (stringValue.includes(".")) {
    const partInt = stringValue.split(".")[0].trim();
    let partDec = stringValue.split(".")[1].trim();
    //multiply the part int*10¹⁸
    const exp = new BN(10).pow(new BN(18));
    const part1 = new BN(partInt).mul(exp);
    //add zeroes to the decimal part.
    while (partDec.length < 18) {
      partDec += "0";
    }
    return part1.add(new BN(partDec));
  } else {
    return new BN((Math.pow(10, 18) * parseFloat(stringValue)).toString());
  }
}

export async function openInNewTab(driver: WebDriver, url: string) {
  const windowsBefore = await driver.getAllWindowHandles();
  await driver.executeScript(`window.open("${url}");`);
  const windowsAfterNewTab = await driver.getAllWindowHandles();
  const newTabHandler = windowsAfterNewTab.filter(
    (item) => windowsBefore.indexOf(item) < 0
  )[0];
  await driver.switchTo().window(newTabHandler);
}

export async function swithToTheOtherTab(driver: WebDriver) {
  const availableTabs = await driver.getAllWindowHandles();
  const currentTab = await driver.getWindowHandle();
  const otherTab = availableTabs.filter((tab) => tab !== currentTab)[0];
  await driver.switchTo().window(otherTab);
}
