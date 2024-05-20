/*
 *
 * @group rollupWithdraw
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
import {
  WithdrawActionType,
  WithdrawModal,
} from "../../utils/frontend/rollup-pages/WithdrawModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const GETH_ASSET_NAME = "GETH";

describe("Gasp UI withdraw tests", () => {
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

  test("User can withdraw GETH", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openWithdraw();
    const withdrawModal = new WithdrawModal(driver);
    const isModalVisible = await withdrawModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await withdrawModal.openChainList();
    await withdrawModal.selectChain("Ethereum");
    await withdrawModal.openTokensList();
    await withdrawModal.waitForTokenListElementsVisible(GETH_ASSET_NAME);
    await withdrawModal.selectToken(GETH_ASSET_NAME);
    await withdrawModal.enterValue("1");

    await withdrawModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed =
      await withdrawModal.isDestinationFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();

    const isNetworkButtonEnabled = await withdrawModal.isNetworkButtonEnabled();
    expect(isNetworkButtonEnabled).toBeTruthy();

    await withdrawModal.clickWithdrawButtonByText(WithdrawActionType.Network);
    await acceptNetworkSwitchInNewWindow(driver);

    await withdrawModal.clickWithdrawButtonByText(WithdrawActionType.Withdraw);
    await waitForActionNotification(driver, TransactionType.Withdraw);
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
