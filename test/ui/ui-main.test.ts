import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Swap } from "../../utils/frontend/pages/Swap";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  takeScreenshot,
} from "../../utils/frontend/utils/Helper";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  mETH_ASSET_NAME,
  MGA_ASSET_ID,
  MGA_ASSET_NAME,
} from "../../utils/utils";

jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe.skip("UI tests - Extension management", () => {
  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    driver = await DriverBuilder.getInstance();
  });

  it("As a User I get infomed whenever is neccesary to install any extension", async () => {
    const mga = new Mangata(driver);
    await mga.navigate();
    //TODO: Continue. now blocked by a bug.
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await takeScreenshot(
      driver,
      expect.getState().currentTestName + " - " + session
    );
    await driver.quit();
    const api = getApi();
    await api.disconnect();
  });
});

describe.skip("UI tests - A user can swap tokens", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  const visibleValueNumber = Math.pow(10, 19).toString();

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    driver = await DriverBuilder.getInstance();

    const { polkUserAddress } = await setupAllExtensions(driver);

    testUser1 = new User(keyring, undefined);
    testUser1.addFromAddress(keyring, polkUserAddress);
    sudo = new User(keyring, sudoUserName);
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(visibleValueNumber));
  });

  it("As a User I can Swap tokens - MGA - POLK", async () => {
    const mga = new Mangata(driver);
    await mga.navigate();
    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(mETH_ASSET_NAME);
    await swapView.addFirstAssetAmount("0.0001");
    await swapView.doSwap();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await takeScreenshot(
      driver,
      expect.getState().currentTestName + " - " + session
    );
    await driver.quit();
    const api = getApi();
    await api.disconnect();
  });
});
