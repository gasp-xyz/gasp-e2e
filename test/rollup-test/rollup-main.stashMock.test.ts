/*
 *
 * @group rollupStashMock
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { sleep } from "../../utils/utils";
import "dotenv/config";
import {
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { DepositModal } from "../../utils/frontend/microapps-pages/DepositModal";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";
import RollupStashServiceMockSingleton from "../../utils/rollupStashServiceMockSingleton";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

const acc_name = "acc_automation";
const KSM_ASSET_NAME = "KSM";

describe("Rollup Stash test", () => {

  beforeAll(async () => {
    RollupStashServiceMockSingleton.getInstance().startMock();
    await sleep(5000000);
  
  });

  test("Deposit - enough assets", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openDeposit();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openChainList();
    await depositModal.selectChain("Kusama");
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(KSM_ASSET_NAME);
    await depositModal.selectToken(KSM_ASSET_NAME);
    await depositModal.enterValue("1");

    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();
    const isDestinationFeeDisplayed =
      await depositModal.isDestinationFeeDisplayed();
    expect(isDestinationFeeDisplayed).toBeTruthy();

    const isContinueButtonEnabled =
      await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeTruthy();

    await depositModal.clickContinue();
    await sleep(3000);
    // Temp skip to fix chops xcm
    // await waitForMicroappsActionNotification(
    //   driver,
    //   mangata,
    //   kusama,
    //   TransactionType.Deposit,
    //   5,
    // );
  });

  afterAll(async () => {
    RollupStashServiceMockSingleton.getInstance().stopServer();
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
