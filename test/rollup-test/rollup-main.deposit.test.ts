/*
 *
 * @group rollupDepositDev
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
} from "../../utils/frontend/rollup-utils/Handlers";
import { WalletWrapper } from "../../utils/frontend/rollup-pages/WalletWrapper";
import {
  DepositActionType,
  DepositModal,
} from "../../utils/frontend/rollup-utils/DepositModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const ETH_ASSET_NAME = "ETH";
const CHAIN_NAME = "Holesky";

describe("Gasp UI deposit tests", () => {
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

  test("User can deposit ETH", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openDeposit();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openChainList();
    await depositModal.selectChain(CHAIN_NAME);
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(ETH_ASSET_NAME);
    await depositModal.selectToken(ETH_ASSET_NAME);

    const randomNum = Math.floor(Math.random() * 99) + 1;
    await depositModal.enterValue("1." + randomNum.toString());

    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    const isNetworkButtonEnabled = await depositModal.isNetworkButtonEnabled();
    expect(isNetworkButtonEnabled).toBeTruthy();

    await depositModal.clickDepositButtonByText(DepositActionType.Network);
    await acceptNetworkSwitchInNewWindow(driver);

    // await depositModal.clickDepositButtonByText(DepositActionType.Approve);
    // await waitForActionNotification(driver, TransactionType.ApproveContract);

    await depositModal.clickDepositButtonByText(DepositActionType.Deposit);
    // await waitForActionNotification(driver, TransactionType.Deposit);
  });

  test("User can deposit ETH - rejected", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openDeposit();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openChainList();
    await depositModal.selectChain(CHAIN_NAME);
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(ETH_ASSET_NAME);
    await depositModal.selectToken(ETH_ASSET_NAME);

    const randomNum = Math.floor(Math.random() * 99) + 1;
    await depositModal.enterValue("1." + randomNum.toString());

    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    await depositModal.clickDepositButtonByText(DepositActionType.Deposit);
    // await waitForActionNotification(driver, TransactionType.Deposit, true);
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
