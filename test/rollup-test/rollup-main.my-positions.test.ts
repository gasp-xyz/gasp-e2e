/*
 *
 * @group rollupMyPositionsDev
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  acceptNetworkSwitchInNewWindow,
  addExtraLogs,
  importMetamaskExtension,
} from "../../utils/frontend/utils/Helper";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForActionNotification,
} from "../../utils/frontend/rollup-utils/Handlers";
import { WalletWrapper } from "../../utils/frontend/rollup-pages/WalletWrapper";
import { TransactionType } from "../../utils/frontend/rollup-pages/NotificationToast";
import { Sidebar } from "../../utils/frontend/rollup-pages/Sidebar";
import { MyPositionsPage } from "../../utils/frontend/rollup-pages/MyPositionsPage";
import { sleep } from "../../utils/utils";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const ETH_ASSET_NAME = "ETH";
const GASP_ASSET_NAME = "GASPV2";

describe("Gasp UI swap tests", () => {
  let sidebar: Sidebar;
  let myPositionsPage: MyPositionsPage;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    acc_addr = await importMetamaskExtension(driver, true);
    acc_addr_short = acc_addr.slice(-4);

    await setupPage(driver);
    await connectWallet(driver, "MetaMask", acc_addr_short);
  });

  it("Remove pool liquidity", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    sidebar = new Sidebar(driver);
    await sidebar.clickNavPositions();

    myPositionsPage = new MyPositionsPage(driver);
    await myPositionsPage.waitForPoolPositionsVisible();
    const isPoolVisible = await myPositionsPage.isLiqPoolDisplayed(
      GASP_ASSET_NAME,
      ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();

    await myPositionsPage.clickPoolPosition(GASP_ASSET_NAME, ETH_ASSET_NAME);
    await myPositionsPage.setupRemoveLiquidityPercentage("1");
    await myPositionsPage.waitForFeeVisible();

    await myPositionsPage.clickSwitchNetwork();
    await acceptNetworkSwitchInNewWindow(driver);
    await sleep(500);
    await myPositionsPage.clickRemoveLiquidity();
    await myPositionsPage.clickConfirmFeeAmount();
    await waitForActionNotification(driver, TransactionType.RemoveLiquidity);
  });

  it("Remove pool liquidity - rejected", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    sidebar = new Sidebar(driver);
    await sidebar.clickNavPositions();

    myPositionsPage = new MyPositionsPage(driver);
    await myPositionsPage.waitForPoolPositionsVisible();
    const isPoolVisible = await myPositionsPage.isLiqPoolDisplayed(
      GASP_ASSET_NAME,
      ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();

    await myPositionsPage.clickPoolPosition(GASP_ASSET_NAME, ETH_ASSET_NAME);
    await myPositionsPage.setupRemoveLiquidityPercentage("1");
    await myPositionsPage.waitForFeeVisible();

    await sleep(500);
    await myPositionsPage.clickRemoveLiquidity();
    await myPositionsPage.clickConfirmFeeAmount();
    await waitForActionNotification(driver, TransactionType.RemoveLiquidity, true);
  });

  it("Cant remove 0 pc pool liquidity", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    sidebar = new Sidebar(driver);
    await sidebar.clickNavPositions();

    myPositionsPage = new MyPositionsPage(driver);
    await myPositionsPage.waitForPoolPositionsVisible();
    const isPoolVisible = await myPositionsPage.isLiqPoolDisplayed(
      GASP_ASSET_NAME,
      ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();

    await myPositionsPage.clickPoolPosition(GASP_ASSET_NAME, ETH_ASSET_NAME);
    await myPositionsPage.setupRemoveLiquidityPercentage("0");

    await sleep(500);
    const isSubmitEnabled = await myPositionsPage.isSubmitEnabled();
    expect(isSubmitEnabled).toBeFalsy();
  });

  it("Add pool liquidity", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    sidebar = new Sidebar(driver);
    await sidebar.clickNavPositions();

    myPositionsPage = new MyPositionsPage(driver);
    await myPositionsPage.waitForPoolPositionsVisible();
    const isPoolVisible = await myPositionsPage.isLiqPoolDisplayed(
      GASP_ASSET_NAME,
      ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();

    await myPositionsPage.clickPoolPosition(GASP_ASSET_NAME, ETH_ASSET_NAME);

    await myPositionsPage.clickAddLiquidity();
    const isFirstTokenNameSet =
      await myPositionsPage.isFirstTokenNameSet(GASP_ASSET_NAME);
    expect(isFirstTokenNameSet).toBeTruthy();
    const isSecondTokenNameSet =
      await myPositionsPage.isSecondTokenNameSet(ETH_ASSET_NAME);
    expect(isSecondTokenNameSet).toBeTruthy();

    // only first token value set by user
    await myPositionsPage.setFirstTokenAmount("0.01");
    await myPositionsPage.waitForAddLiqFeeVisible();
    await myPositionsPage.waitSecondTokenAmountSet(true);
    await driver.sleep(500);
    const firstTokenAmount = await myPositionsPage.getFirstTokenAmount();
    expect(firstTokenAmount).toBeGreaterThan(0);
    await myPositionsPage.submitAddLiq();

    await waitForActionNotification(driver, TransactionType.AddLiquidity);
  });

  it("Add pool liquidity - rejected", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    sidebar = new Sidebar(driver);
    await sidebar.clickNavPositions();

    myPositionsPage = new MyPositionsPage(driver);
    await myPositionsPage.waitForPoolPositionsVisible();
    const isPoolVisible = await myPositionsPage.isLiqPoolDisplayed(
      GASP_ASSET_NAME,
      ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();

    await myPositionsPage.clickPoolPosition(GASP_ASSET_NAME, ETH_ASSET_NAME);

    await myPositionsPage.clickAddLiquidity();
    const isFirstTokenNameSet =
      await myPositionsPage.isFirstTokenNameSet(GASP_ASSET_NAME);
    expect(isFirstTokenNameSet).toBeTruthy();
    const isSecondTokenNameSet =
      await myPositionsPage.isSecondTokenNameSet(ETH_ASSET_NAME);
    expect(isSecondTokenNameSet).toBeTruthy();

    // only first token value set by user
    await myPositionsPage.setSecondTokenAmount("0.01");
    await myPositionsPage.waitForAddLiqFeeVisible();
    await myPositionsPage.waitFirstTokenAmountSet(true);

    await driver.sleep(500);
    await myPositionsPage.submitAddLiq();

    await waitForActionNotification(driver, TransactionType.AddLiquidity, true);
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
    DriverBuilder.destroy();
  });
});
