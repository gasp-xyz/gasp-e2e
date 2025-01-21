/*
 *
 * @group rollupDepositProdMobile
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importMetamaskExtension,
} from "../../utils/frontend/utils/Helper";
import "dotenv/config";
import {
  approveContractIfEligible,
  connectWalletMobile,
  setupPage,
  setupPageWithStateMobile,
  switchNetworkIfEligible,
  waitForActionNotification,
} from "../../utils/frontend/rollup-utils/Handlers";
import { WalletWrapperMobile } from "../../utils/frontend/rollup-pages/WalletWrapperMobile";
import { DepositActionType } from "../../utils/frontend/rollup-utils/DepositModal";
import { TransactionType } from "../../utils/frontend/rollup-pages/NotificationToast";
import { DepositModalMobile } from "../../utils/frontend/rollup-utils/DepositModalMobile";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const ETH_ASSET_NAME = "ETH";
const USDC_ASSET_NAME = "USDC";

// Mobile device configuration
const MOBILE_DEVICE = {
  deviceName: "iPhone 12 Pro",
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
};

describe("Gasp Prod UI deposit tests - Mobile", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    // Get driver instance with mobile configuration
    driver = await DriverBuilder.getInstance(true, false, MOBILE_DEVICE);
    acc_addr = await importMetamaskExtension(driver, true);
    acc_addr_short = acc_addr.slice(-4).toUpperCase();

    await setupPage(driver);
    await connectWalletMobile(driver, "MetaMask", acc_addr_short, true);
  });

  test("Mobile: User can deposit USDC(arb) - rejected", async () => {
    await setupPageWithStateMobile(driver, acc_addr_short);

    const walletWrapper = new WalletWrapperMobile(driver);
    // Use mobile-specific selectors or methods if needed
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openDeposit();

    const depositModal = new DepositModalMobile(driver);
    await depositModal.waitForModalVisible();
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    // Mobile-specific chain selection
    await depositModal.openChainList();
    await depositModal.selectChain("Arbitrum One");

    // Mobile-specific token selection
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(USDC_ASSET_NAME);
    await depositModal.selectToken(USDC_ASSET_NAME);

    // Enter value (same as desktop)
    const randomNum = Math.floor(Math.random() * 99) + 1;
    await depositModal.enterValue("1.01" + randomNum.toString());

    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    await switchNetworkIfEligible(driver, DepositActionType.NetworkArbitrum);
    await approveContractIfEligible(driver);

    await depositModal.clickDepositButtonByText(DepositActionType.Deposit);
    await waitForActionNotification(driver, TransactionType.Deposit, true);

    const modalText = await depositModal.getModalText();
    expect(modalText).toContain("User rejected the request");
    expect(modalText).toContain("Something went wrong");

    await depositModal.goBack();
    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayedPostError =
      await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayedPostError).toBeTruthy();
  });

  test("Mobile: User can deposit ETH(arb) - rejected", async () => {
    await setupPageWithStateMobile(driver, acc_addr_short);

    const walletWrapper = new WalletWrapperMobile(driver);
    // Use mobile-specific selectors or methods if needed
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openDeposit();

    const depositModal = new DepositModalMobile(driver);
    await depositModal.waitForModalVisible();
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    // Mobile-specific chain selection
    await depositModal.openChainList();
    await depositModal.selectChain("Arbitrum One");

    // Mobile-specific token selection
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(ETH_ASSET_NAME);
    await depositModal.selectToken(ETH_ASSET_NAME);

    // Enter value (same as desktop)
    const randomNum = Math.floor(Math.random() * 99) + 1;
    await depositModal.enterValue("0.0001" + randomNum.toString());

    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    await switchNetworkIfEligible(driver, DepositActionType.NetworkArbitrum);
    await approveContractIfEligible(driver);

    await depositModal.clickDepositButtonByText(DepositActionType.Deposit);
    await waitForActionNotification(driver, TransactionType.Deposit, true);

    const modalText = await depositModal.getModalText();
    expect(modalText).toContain("User rejected the request");
    expect(modalText).toContain("Something went wrong");

    await depositModal.goBack();
    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayedPostError =
      await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayedPostError).toBeTruthy();
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
