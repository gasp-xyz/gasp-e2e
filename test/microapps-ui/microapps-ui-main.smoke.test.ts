/*
 *
 * @group microappsUI
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";

import { FIVE_MIN } from "../../utils/Constants";
import { Main } from "../../utils/frontend/microapps-pages/Main";
import {
  connectWallet,
  setupPage,
} from "../../utils/frontend/microapps-utils/Handlers";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("Miocroapps UI smoke tests", () => {
  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  it("App is starting", async () => {
    driver = await DriverBuilder.getInstance(true);
    const acc_name = "acc_automation";
    await importPolkadotExtension(driver);
    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
    const mainPage = new Main(driver);
    const appLoaded = await mainPage.isAppLoaded();
    expect(appLoaded).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    await DriverBuilder.destroy();
  });
});
