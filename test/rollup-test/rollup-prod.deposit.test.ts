/*
 *
 * @group rollupDepositProd
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
import {
  DepositActionType,
  DepositModal,
} from "../../utils/frontend/rollup-utils/DepositModal";
import { TransactionType } from "../../utils/frontend/rollup-pages/NotificationToast";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const GETH_ASSET_NAME = "GETH";

describe("Gasp Prod UI deposit tests", () => {
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

  test("User can deposit GETH", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const tokensAmountBefore = await walletWrapper.getMyTokensRowAmount(GETH_ASSET_NAME);
    await walletWrapper.openDeposit();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openChainList();
    await depositModal.selectChain("Ethereum");
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(GETH_ASSET_NAME);
    await depositModal.selectToken(GETH_ASSET_NAME);

    const randomNum = Math.floor(Math.random() * 99) + 1;
    await depositModal.enterValue("1." + randomNum.toString());

    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    const isNetworkButtonEnabled = await depositModal.isNetworkButtonEnabled();
    expect(isNetworkButtonEnabled).toBeTruthy();

    await depositModal.clickDepositButtonByText(DepositActionType.Network);
    await acceptNetworkSwitchInNewWindow(driver);

    await depositModal.clickDepositButtonByText(DepositActionType.Approve);
    await waitForActionNotification(driver, TransactionType.ApproveContract);

    await depositModal.clickDepositButtonByText(DepositActionType.Deposit);
    await waitForActionNotification(driver, TransactionType.Deposit);
    await depositModal.clickDepositButtonByText(DepositActionType.Done);

    await walletWrapper.waitTokenAmountChange(GETH_ASSET_NAME, tokensAmountBefore);
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
