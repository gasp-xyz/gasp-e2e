import "chromedriver";
import {
  By,
  Key,
  logging,
  until,
  WebDriver,
  WebElement,
} from "selenium-webdriver";
import { sleep } from "../../utils";
import { Mangata } from "../pages/Mangata";
import { Polkadot } from "../pages/Polkadot";
import { MetaMask } from "../pages/MetaMask";
import "jest-extended";
import fs from "fs";
import { testLog } from "../../Logger";
import { BN } from "@polkadot/util";
import { Talisman } from "../pages/Talisman";
import { LiqPools } from "../microapps-pages/LiqPools";
import toNumber from "lodash-es/toNumber";
import { HttpResponse } from "selenium-webdriver/networkinterceptor";

const timeOut = 60000;
const outputPath = `reports/artifacts`;
export async function waitForElement(
  driver: WebDriver,
  xpath: string,
  timeout = timeOut,
) {
  await driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
}

type SetupFunction = (
  driver: WebDriver,
) => Promise<{ polkUserAddress: string; mnemonic: string }>;

const walletSetupFunction: Record<string, SetupFunction> = {
  Polkadot: setupPolkadotExtension,
  Talisman: setupTalismanExtension,
  default: setupPolkadotExtension,
};

type WalletPermissionFunction = Record<
  string,
  (driver: WebDriver) => Promise<void>
>;

const acceptWalletPermissionFunction: WalletPermissionFunction = {
  Polkadot: acceptPermissionsPolkadotExtensionInNewWindow,
  Talisman: acceptPermissionsTalismanExtensionInNewWindow,
  Metamask: acceptPermissionsMetamaskExtensionInNewWindow,
};

export async function setupWalletExtension(
  driver: WebDriver,
  walletType: string,
) {
  const setupFunction =
    walletSetupFunction[walletType] || walletSetupFunction.default;
  await setupFunction(driver);
}

export async function waitForElementEnabled(
  driver: WebDriver,
  xpath: string,
  timeout = timeOut,
) {
  await waitForElement(driver, xpath, timeout);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.wait(until.elementIsEnabled(element), timeout);
}

export async function waitForElementState(
  driver: WebDriver,
  xpath: string,
  isEnabled: boolean,
  timeout = 5000,
) {
  const element = await driver.wait(until.elementLocated(By.xpath(xpath)));
  await driver.wait(until.elementIsVisible(element), timeout);

  if (isEnabled) {
    await driver.wait(until.elementIsEnabled(element), timeout);
  } else {
    await driver.wait(until.elementIsDisabled(element), timeout);
  }
}

export async function waitInputValueSetInterval(
  driver: WebDriver,
  xpath: string,
  isSet: boolean,
  timeout = 5000,
) {
  const startTime = Date.now();
  const endTime = startTime + timeout;

  while (Date.now() < endTime) {
    try {
      const element = await driver.findElement(By.xpath(xpath));
      const isElementVisible = await element.isDisplayed();

      if (isSet) {
        const value = await element.getAttribute("value");
        if (isElementVisible && value !== "") {
          return;
        }
      } else {
        const value = await element.getAttribute("value");
        if (isElementVisible && value === "") {
          return;
        }
      }
    } catch (error) {
      // Element not found or other error occurred, continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Timeout: Element value not as desired after ${timeout} milliseconds`,
  );
}

export async function waitForElementStateInterval(
  driver: WebDriver,
  xpath: string,
  isEnabled: boolean,
  timeout = 10000,
) {
  const startTime = Date.now();
  const endTime = startTime + timeout;

  while (Date.now() < endTime) {
    try {
      const element = await driver.findElement(By.xpath(xpath));
      const isElementVisible = await element.isDisplayed();

      if (isEnabled) {
        const isElementEnabled = await element.isEnabled();
        if (isElementVisible && isElementEnabled) {
          return;
        }
      } else {
        const isElementDisabled = !(await element.isEnabled());
        if (isElementVisible && isElementDisabled) {
          return;
        }
      }
    } catch (error) {
      // Element not found or other error occurred, continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Timeout: Element ${xpath} state not as desired after ${timeout} milliseconds`,
  );
}

export async function waitForElementVisible(
  driver: WebDriver,
  xpath: string,
  timeout = timeOut,
) {
  await waitForElement(driver, xpath, timeout);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.wait(until.elementIsVisible(element), timeout);
}

export async function waitForElementToDissapear(
  driver: WebDriver,
  xpath: string,
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

export async function waitForHttpCall(
  driver: WebDriver,
  callPattern: string,
  timeout = 10000,
): Promise<number> {
  return await driver.wait(async function () {
    const logs = await driver.manage().logs().get("performance");
    for (const entry of logs) {
      const log = JSON.parse(entry.message).message;
      const resp: HttpResponse = log.params.response;
      if (
        log.method === "Network.responseReceived" &&
        log.params.response.url.includes(callPattern)
      ) {
        return resp.status;
      }
    }
    return 200;
  }, timeout);
}

export async function waitForLoad(
  retry = 2,
  loaderXpath: string,
  driver: WebDriver,
): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    setTimeout(async () => {
      const visible = await isDisplayed(driver, loaderXpath);
      if (visible) {
        if (retry > 0) {
          testLog.getLog().warn("Retrying wait for load: attempt " + retry);
          await driver.navigate().refresh();
          retry = retry - 1;
          return waitForLoad(retry, loaderXpath, driver);
        }
        reject("TIMEOUT: Waiting for " + loaderXpath + " to dissapear");
      } else {
        resolve();
      }
    }, 60000);
    await waitForElementToDissapear(driver, loaderXpath);
    resolve();
  });
}

export async function getNumberOfElements(
  driver: WebDriver,
  xpath: string,
  timeout = timeOut,
) {
  await waitForElement(driver, xpath, timeout);
  const elements = await driver.findElements(By.xpath(xpath));
  return elements.length;
}

export async function clickElement(driver: WebDriver, xpath: string) {
  await waitForElement(driver, xpath);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.wait(until.elementIsVisible(element), timeOut);
  await sleep(500);
  await driver.wait(until.elementIsEnabled(element), timeOut);
  await element.click();
}

export async function scrollIntoView(driver: WebDriver, xpath: string) {
  await waitForElement(driver, xpath);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.executeScript(
    'arguments[0].scrollIntoView({ behavior: "smooth" });',
    element,
  );
  await driver.wait(until.elementIsVisible(element), timeOut);
}

export async function scrollElementIntoView(
  driver: WebDriver,
  element: WebElement,
) {
  await driver.executeScript(
    'arguments[0].scrollIntoView({ behavior: "smooth" });',
    element,
  );
  await driver.wait(until.elementIsVisible(element), timeOut);
}

export async function clickElementForce(driver: WebDriver, xpath: string) {
  await waitForElement(driver, xpath);
  const element = await driver.findElement(By.xpath(xpath));
  await driver.wait(until.elementIsVisible(element), timeOut);
  await sleep(500);
  driver.executeScript("arguments[0].click();", element);
}

export async function pressEscape(driver: WebDriver) {
  await driver.actions().sendKeys(Key.ESCAPE).perform();
}

export async function writeText(
  driver: WebDriver,
  elementXpath: string,
  text: string,
) {
  await waitForElement(driver, elementXpath);
  await (await driver.findElement(By.xpath(elementXpath))).clear();
  const input = await driver.findElement(By.xpath(elementXpath));
  await driver.executeScript("arguments[0].value = '';", input);
  await (await driver.findElement(By.xpath(elementXpath))).sendKeys(text);
}

export async function writeTextManual(
  driver: WebDriver,
  elementXpath: string,
  text: string,
) {
  await waitForElement(driver, elementXpath);
  await clearTextManual(driver, elementXpath);
  await (await driver.findElement(By.xpath(elementXpath))).sendKeys(text);
}

export async function appendText(
  driver: WebDriver,
  elementXpath: string,
  text: string,
) {
  await waitForElement(driver, elementXpath);
  const element = await driver.findElement(By.xpath(elementXpath));
  await element.sendKeys(text);
}

export async function clearText(driver: WebDriver, elementXpath: string) {
  await waitForElement(driver, elementXpath);
  await (await driver.findElement(By.xpath(elementXpath))).clear();
  await driver.sleep(500);
}

export async function clearTextManual(driver: WebDriver, elementXpath: string) {
  await waitForElement(driver, elementXpath);
  const inputField = await driver.findElement(By.xpath(elementXpath));
  while ((await inputField.getAttribute("value")) !== "") {
    await inputField.sendKeys(Key.BACK_SPACE);
  }
  await driver.sleep(500);
}

export async function getText(driver: WebDriver, elementXpath: string) {
  await waitForElement(driver, elementXpath);
  return await (await driver.findElement(By.xpath(elementXpath))).getText();
}

export async function getAttribute(
  driver: WebDriver,
  elementXpath: string,
  attrName = "value",
) {
  await waitForElement(driver, elementXpath);
  return await (
    await driver.findElement(By.xpath(elementXpath))
  ).getAttribute(attrName);
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

export async function importPolkadotExtension(
  driver: WebDriver,
  mnemonicKeys = "",
) {
  await leaveOnlyOneTab(driver);

  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.go();
  if (mnemonicKeys === "") {
    await polkadotExtension.setupAccount();
  } else {
    await polkadotExtension.setupAccount(mnemonicKeys);
  }
}

export async function importMetamaskExtension(
  driver: WebDriver,
  withPrivateKey = false,
): Promise<string> {
  await leaveOnlyOneTab(driver);

  const extension = MetaMask.getInstance(driver);
  await extension.go();
  if (withPrivateKey) {
    return await extension.setupAccountPrivKey();
  } else {
    return await extension.setupAccount();
  }
}

export async function setupTalismanExtension(driver: WebDriver) {
  await leaveOnlyOneTab(driver);

  const talismanExtension = new Talisman(driver);
  await talismanExtension.go();
  const [talismanUserAddress, usrMnemonic] =
    await talismanExtension.createAccount();

  await new Mangata(driver).go();
  await sleep(2000);

  return {
    polkUserAddress: talismanUserAddress,
    mnemonic: usrMnemonic,
  };
}

export async function acceptPermissionsPolkadotExtension(driver: WebDriver) {
  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.go();
  await polkadotExtension.acceptPermissions();
}

export async function acceptPermissionsWalletExtensionInNewWindow(
  driver: WebDriver,
  walletType: string,
) {
  const acceptPermissions =
    acceptWalletPermissionFunction[walletType] ||
    acceptPermissionsPolkadotExtensionInNewWindow;
  await acceptPermissions(driver);
}

export async function acceptPermissionsPolkadotExtensionInNewWindow(
  driver: WebDriver,
) {
  const polkadotExtension = new Polkadot(driver);
  await polkadotExtension.acceptPermissions();
}

export async function acceptPermissionsTalismanExtensionInNewWindow(
  driver: WebDriver,
) {
  const polkadotExtension = new Talisman(driver);
  await polkadotExtension.acceptPermissions();
}

export async function acceptPermissionsMetamaskExtensionInNewWindow(
  driver: WebDriver,
) {
  const metamaskExtension = MetaMask.getInstance(driver);
  await metamaskExtension.acceptPermissions();
}

export async function acceptNetworkSwitchInNewWindow(driver: WebDriver) {
  await MetaMask.acceptNetworkSwitch(driver);
}

export async function acceptContractInNewWindow(driver: WebDriver) {
  //todo: value check
  await MetaMask.acceptContractInDifferentWindow(driver);
}

export async function leaveOnlyOneTab(driver: WebDriver) {
  const handles = await driver.getAllWindowHandles();
  if (handles.length <= 1) {
    return;
  }
  for (let index = 1; index < handles.length; index++) {
    const handle = handles[index];
    await driver.switchTo().window(handle);
    await driver.close();
  }
  await driver.switchTo().window(handles[0]);
}

export async function isDisplayed(driver: WebDriver, elementXpath: string) {
  try {
    await waitForElement(driver, elementXpath, 6000);
    return await (
      await driver.findElement(By.xpath(elementXpath))
    ).isDisplayed();
  } catch (Error) {
    return false;
  }
}

export async function areDisplayed(
  driver: WebDriver,
  listDataTestIds: string[],
) {
  const promises: Promise<boolean>[] = listDataTestIds.map((dataTestId) =>
    isDisplayed(driver, dataTestId),
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
            logLine + " \n",
          );
        });
      });
  });
  const img = await driver.takeScreenshot();
  fs.writeFileSync(`${outputPath}/screenshot_${testName}.png`, img, "base64");
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
  return JSON.parse(
    fs.readFileSync(polkadotUserJson, { encoding: "utf8", flag: "r" }),
  );
}

export function buildDataTestIdSelector(dataTestId: string) {
  return By.xpath(buildDataTestIdXpath(dataTestId));
}

export function buildDataTestIdXpath(dataTestId: string) {
  return `//*[@data-testid='${dataTestId}']`;
}

export function buildDataTestIdXpathFunction(
  dataTestId: string,
  xpathFunction: string,
) {
  return `//*[@data-testid[${xpathFunction}(., '${dataTestId}')]]`;
}

export function buildClassXpath(className: string) {
  return `//*[@class='${className}']`;
}

export function buildHrefXpath(hrefName: string) {
  return `//*[@href='${hrefName}']`;
}

export async function waitForNewWindow(
  driver: WebDriver,
  timeout: number,
  retryInterval: number,
): Promise<void> {
  const currentWindowHandle = await driver.getWindowHandle();

  const startTime = Date.now();
  let elapsedTime = 0;

  while (elapsedTime < timeout) {
    const windowHandles = await driver.getAllWindowHandles();
    if (
      windowHandles.length > 1 &&
      windowHandles.includes(currentWindowHandle)
    ) {
      return;
    }

    await driver.sleep(retryInterval);
    elapsedTime = Date.now() - startTime;
  }

  throw new Error(`Timed out waiting for new window to appear.`);
}

export async function doActionInDifferentWindow(
  driver: WebDriver,
  fn: (driver: WebDriver) => void,
) {
  await waitForNewWindow(driver, 10000, 500);
  let handle = await (await driver).getAllWindowHandles();
  let iterator = handle.reverse().entries();

  let value = iterator.next().value;
  while (value) {
    await driver.switchTo().window(value[1]);

    try {
      await fn(driver);
      break;
    } catch (error) {
      testLog.getLog().error("Error occurred in new window:", error);
    }
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
  driver: WebDriver,
) {
  const assetTestId = `TokensModal-token-${assetName}`;
  const assetLocator = buildDataTestIdXpath(assetTestId);
  await clickElement(driver, assetLocator);
}

export function uiStringToBN(stringValue: string, decimals = 18) {
  if (stringValue.includes(".")) {
    const partInt = stringValue.split(".")[0].trim();
    let partDec = stringValue.split(".")[1].trim();
    //multiply the part int*10¹⁸
    const exp = new BN(10).pow(new BN(decimals));
    const part1 = new BN(partInt).mul(exp);
    //add zeroes to the decimal part.
    while (partDec.length < decimals) {
      partDec += "0";
    }
    return part1.add(new BN(partDec));
  } else {
    return new BN(
      (Math.pow(10, decimals) * parseFloat(stringValue)).toString(),
    );
  }
}

export async function uiStringToNumber(stringValue: string) {
  let partIntNum: number;
  let partDecNum: number;
  let numberValue: number = 0;
  stringValue = stringValue.replaceAll(",", "");
  const partInt = stringValue.split(".")[0];
  const partDec = stringValue.split(".")[1];
  const millions = await stringValue.includes("M");
  const kilos = await stringValue.includes("K");
  if (millions) {
    partIntNum = toNumber(partInt) * 1000000;
    partDecNum = toNumber(partDec.replace("M", "")) * 10000;
    numberValue = partIntNum + partDecNum;
  }
  if (kilos) {
    partIntNum = toNumber(partInt) * 1000;
    partDecNum = toNumber(partDec.replace("K", "")) * 10;
    numberValue = partIntNum + partDecNum;
  }
  if (!millions && !kilos) {
    numberValue = toNumber(stringValue);
  }
  return numberValue;
}

export async function openInNewTab(driver: WebDriver, url: string) {
  const windowsBefore = await driver.getAllWindowHandles();
  await driver.executeScript(`window.open("${url}");`);
  const windowsAfterNewTab = await driver.getAllWindowHandles();
  const newTabHandler = windowsAfterNewTab.filter(
    (item) => windowsBefore.indexOf(item) < 0,
  )[0];
  await driver.switchTo().window(newTabHandler);
}

export async function swithToTheOtherTab(driver: WebDriver) {
  const availableTabs = await driver.getAllWindowHandles();
  const currentTab = await driver.getWindowHandle();
  const otherTab = availableTabs.filter((tab) => tab !== currentTab)[0];
  await driver.switchTo().window(otherTab);
}

export async function elementExists(driver: WebDriver, xpath: string) {
  const elements = await driver.findElements(By.xpath(xpath));
  return elements.length > 0;
}

export function buildXpathByText(text: string) {
  return `//*[contains(., "${text}")]`;
}

export function buildXpathByMultiText(texts: string[]) {
  return `/*[${texts.map((text) => `contains(., "${text}")`).join(" and ")}]`;
}

export function buildXpathByElementText(element: string, text: string) {
  return `//${element}[contains(., "${text}")]`;
}

export async function comparePoolsLists(
  fePoolsList: any,
  bePoolsInfo: any,
  liquidityPools: LiqPools,
) {
  const bePoolsInfoLength = bePoolsInfo.length;
  const bePoolsList = [];
  for (let i = 0; i < bePoolsInfoLength; i++) {
    const isPoolVisible = await liquidityPools.isPoolItemDisplayed(
      "-" + bePoolsInfo[i].firstToken + "-" + bePoolsInfo[i].secondToken,
      false,
    );
    if (isPoolVisible) {
      bePoolsList.push(
        "pool-item" +
          "-" +
          bePoolsInfo[i].firstToken +
          "-" +
          bePoolsInfo[i].secondToken,
      );
    } else {
      bePoolsList.push(
        "pool-item" +
          "-" +
          bePoolsInfo[i].secondToken +
          "-" +
          bePoolsInfo[i].firstToken,
      );
    }
  }
  expect(bePoolsList).toIncludeSameMembers(fePoolsList);
}
