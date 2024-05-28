/*
 *
 * @group rollupSwap
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
import { Swap, SwapActionType } from "../../utils/frontend/rollup-pages/Swap";
import { sleep } from "../../utils/utils";
import { BalanceWarningModal } from "../../utils/frontend/rollup-pages/BalanceWarningModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const GETH_ASSET_NAME = "GETH";
const GASP_ASSET_NAME = "GASP";

describe("Gasp UI deposit tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    acc_addr = await importMetamaskExtension(driver, true);
    acc_addr_short = acc_addr.slice(-4).toLowerCase();

    await setupPage(driver);
    await connectWallet(driver, "Metamask", acc_addr_short);
  });

  it("Swap is disabled with not enough tokens", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(GETH_ASSET_NAME);
    await swap.pickGetToken(GASP_ASSET_NAME);
    await swap.setPayTokenAmount("10000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    const isSwapEnabled = await swap.isSwapButtonEnabled();
    expect(isSwapEnabled).toBeFalsy();
  });

  it("Warning of low balance after swap", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const tokensAmountBefore =
      await walletWrapper.getMyTokensRowAmount(GASP_ASSET_NAME);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(GASP_ASSET_NAME);
    await swap.pickGetToken(GETH_ASSET_NAME);
    await swap.setPayTokenAmount(tokensAmountBefore);
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    const isSwapEnabled = await swap.isSwapButtonEnabled();
    expect(isSwapEnabled).toBeTruthy();

    await swap.clickSwapButtonByAction(SwapActionType.Network);
    await acceptNetworkSwitchInNewWindow(driver);
    await swap.clickSwapButtonByAction(SwapActionType.Swap);

    const balanceWarningModal = new BalanceWarningModal(driver);
    const isBalanceWarningDisplayed = await balanceWarningModal.displayed();
    expect(isBalanceWarningDisplayed).toBeTruthy();
  });

  it("Swap details are visible & dynamic", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(GASP_ASSET_NAME);
    await swap.pickGetToken(GETH_ASSET_NAME);
    await swap.setPayTokenAmount("1000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    const isTradeRateDisplayed = await swap.isTradeRateDisplayed();
    expect(isTradeRateDisplayed).toBeTruthy();

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    await swap.toggleRouteDetails();
    const areRouteDetailsDisplayed = await swap.areRouteDetailsDisplayed(
      GASP_ASSET_NAME,
      GETH_ASSET_NAME,
    );
    expect(areRouteDetailsDisplayed).toBeTruthy();

    const minimumRecieved = await swap.fetchMinimumReceivedAmount();
    await swap.setPayTokenAmount("2000");
    const minimumRecievedAfterChange = await swap.fetchMinimumReceivedAmount();
    expect(minimumRecieved).toBeLessThan(minimumRecievedAfterChange);
  });

  it("Swap fee lock - less than 1k GASP", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(GASP_ASSET_NAME);
    await swap.pickGetToken(GETH_ASSET_NAME);
    await swap.setPayTokenAmount("100");

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    const swapFee = await swap.fetchSwapFee();
    expect(swapFee).toEqual(1);
  });

  it("Swap free - more than 1k GASP", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(GASP_ASSET_NAME);
    await swap.pickGetToken(GETH_ASSET_NAME);
    await swap.setPayTokenAmount("10001");

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    const swapFee = await swap.fetchSwapFee();
    expect(swapFee).toEqual(0);
  });

  it("Switch transaction tokens and values", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(GASP_ASSET_NAME);
    await swap.pickGetToken(GETH_ASSET_NAME);
    await swap.setPayTokenAmount("1000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    await swap.switchTokens();
    await sleep(1000);

    const payTokenNameAfterSwitch = await swap.fetchPayTokenName();
    expect(payTokenNameAfterSwitch).toEqual(GETH_ASSET_NAME);
    const getTokenNameAfterSwitch = await swap.fetchGetTokenName();
    expect(getTokenNameAfterSwitch).toEqual(GASP_ASSET_NAME);
    const payTokeAmountAfterSwitch = await swap.fetchPayAssetAmount();
    expect(payTokeAmountAfterSwitch).toEqual(getTokenAmount);
  });

  test("User can swap with enough tokens", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(GETH_ASSET_NAME);
    await swap.pickGetToken(GASP_ASSET_NAME);
    await swap.setPayTokenAmount("1.213");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    await swap.waitForSwapButtonEnabled();
    const isSwapEnabled = await swap.isSwapButtonEnabled();
    expect(isSwapEnabled).toBeTruthy();

    await swap.clickSwapButtonByAction(SwapActionType.Network);
    await acceptNetworkSwitchInNewWindow(driver);
    await swap.clickSwapButtonByAction(SwapActionType.Swap);
    await waitForActionNotification(driver, TransactionType.Swap);
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
