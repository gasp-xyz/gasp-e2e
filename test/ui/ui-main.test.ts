import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { waitNewBlock } from "../../utils/eventListeners";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { Swap } from "../../utils/frontend/pages/Swap";
import { Pool } from "../../utils/frontend/pages/Pool";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  takeScreenshot,
} from "../../utils/frontend/utils/Helper";
import { getBalanceOfPool } from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  mETH_ASSET_NAME,
  MGA_ASSET_NAME,
} from "../../utils/utils";

const MGA_ASSET_ID = new BN(0);
const ETH_ASSET_ID = new BN(1);

jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - Extension management", () => {
  //  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  it("As a User I get infomed whenever is neccesary to install any extension", async () => {
    driver = await DriverBuilder.getInstance(false);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const metaDiv = await sidebar.isMetamaskExtensionNotFoundDisplayed();
    const polkDiv = await sidebar.isPolkExtensionNotFoundDisplayed();
    const metaBtnInstall = await sidebar.isMetamaskInstallBtnDisplayed();
    const polkBtnInstall = await sidebar.isPolkInstallBtnDisplayed();
    expect(metaDiv).toBeTruthy();
    expect(polkDiv).toBeTruthy();
    expect(metaBtnInstall).toBeTruthy();
    expect(polkBtnInstall).toBeTruthy();
  });

  it("As a User I get feedback when extensions are installed and correctly setup", async () => {
    driver = await DriverBuilder.getInstance();
    await setupAllExtensions(driver);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const metaDiv = await sidebar.isMetamaskExtensionNotFoundDisplayed();
    const polkDiv = await sidebar.isPolkExtensionNotFoundDisplayed();
    const metaBtnInstall = await sidebar.isMetamaskInstallBtnDisplayed();
    const polkBtnInstall = await sidebar.isPolkInstallBtnDisplayed();
    expect(metaDiv).toBeFalsy();
    expect(polkDiv).toBeFalsy();
    expect(metaBtnInstall).toBeFalsy();
    expect(polkBtnInstall).toBeFalsy();

    const isMetaOK = await sidebar.isMetamaskExtensionOK();
    const ispolkOK = await sidebar.isPolkadotExtensionOK();

    expect(isMetaOK).toBeTruthy();
    expect(ispolkOK).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await takeScreenshot(
      driver,
      expect.getState().currentTestName + " - " + session
    );
    await driver.quit();
    DriverBuilder.destroy();
    const api = getApi();
    try {
      await api.disconnect();
    } catch (error) {}
  });
});

describe("UI tests - A user can swap and mint tokens", () => {
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
    keyring = new Keyring({ type: "sr25519" });
  });

  beforeAll(async () => {
    driver = await DriverBuilder.getInstance();

    const { mnemonic } = await setupAllExtensions(driver);

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    sudo = new User(keyring, sudoUserName);
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(visibleValueNumber));
    const balance = await getBalanceOfPool(MGA_ASSET_ID, ETH_ASSET_ID);
    await sudo.mint(
      ETH_ASSET_ID,
      testUser1,
      new BN((parseInt(visibleValueNumber) / 1000).toString())
    );
    if (balance[0].isEmpty || balance[1].isEmpty) {
      await sudo.mint(MGA_ASSET_ID, sudo, new BN(visibleValueNumber));
      await sudo.mint(ETH_ASSET_ID, sudo, new BN(visibleValueNumber));
      const poolValue = new BN(visibleValueNumber).div(new BN(2));
      await sudo.createPoolToAsset(
        poolValue,
        poolValue,
        MGA_ASSET_ID,
        ETH_ASSET_ID
      );
    }
    testUser1.addAsset(MGA_ASSET_ID);
    testUser1.addAsset(ETH_ASSET_ID);
  });

  it("As a User I can Swap tokens - MGA - mETH", async () => {
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(mETH_ASSET_NAME);
    await swapView.addPayAssetAmount("0.001");
    await swapView.doSwap();

    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    for (let index = 0; index < 4; index++) {
      await waitNewBlock(true);
    }

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const swapped = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore!.lt(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!);

    expect(swapped).toBeTruthy();
  });

  it("As a User I can mint some tokens MGA - mETH", async () => {
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(mETH_ASSET_NAME);
    await poolView.selectToken2Asset(MGA_ASSET_NAME);
    await poolView.addToken1AssetAmount("0.001");
    await poolView.provideToPool();

    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    for (let index = 0; index < 4; index++) {
      await waitNewBlock(true);
    }

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const swapped = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore!.gt(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!);
    const poolInvested = await new Sidebar(driver).isLiquidityPoolVisible(
      MGA_ASSET_NAME,
      mETH_ASSET_NAME
    );
    expect(poolInvested).toBeTruthy();
    expect(swapped).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await takeScreenshot(
      driver,
      expect.getState().currentTestName + " - " + session
    );
  });

  afterAll(async () => {
    await driver.quit();
    const api = getApi();
    await api.disconnect();
  });
});
