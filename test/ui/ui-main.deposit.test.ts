/*
 *
 * @group rococoUiDeposit
 */
import { jest } from "@jest/globals";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import { connectPolkadotWallet } from "../../utils/frontend/utils/Handlers";
import { DepositModal } from "../../utils/frontend/pages/DepositModal";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;
const KSM_ASSET_NAME = "ROC";

describe("UI deposit modal tests - no action", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(
      keyring,
      getEnvironmentRequiredVars().mnemonicPolkadot,
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await connectPolkadotWallet(driver, sidebar, mga);
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();
  });

  test("Deposit - enough assets", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    await sidebar.clickOnDepositToMangata();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openTokensList();
    const areTokenListElementsVisible =
      await depositModal.areTokenListElementsVisible(KSM_ASSET_NAME);
    expect(areTokenListElementsVisible).toBeTruthy();
    await depositModal.selectToken(KSM_ASSET_NAME);
    await depositModal.enterValue("1");
    await depositModal.waitForProgressBar();

    await depositModal.waitForContinueState(true);
    const isContinueButtonEnabled =
      await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeTruthy();
  });

  test("Deposit - not enough assets", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    await sidebar.clickOnDepositToMangata();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openTokensList();
    const areTokenListElementsVisible =
      await depositModal.areTokenListElementsVisible(KSM_ASSET_NAME);
    expect(areTokenListElementsVisible).toBeTruthy();
    await depositModal.selectToken(KSM_ASSET_NAME);
    await depositModal.enterValue("10000");
    await depositModal.waitForProgressBar();

    await depositModal.waitForContinueState(false);
    const isContinueButtonEnabled =
      await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeFalsy();
  });

  test("Deposit - below min amount", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    await sidebar.clickOnDepositToMangata();
    const depositModal = new DepositModal(driver);
    const isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openTokensList();
    const areTokenListElementsVisible =
      await depositModal.areTokenListElementsVisible(KSM_ASSET_NAME);
    expect(areTokenListElementsVisible).toBeTruthy();
    await depositModal.selectToken(KSM_ASSET_NAME);
    await depositModal.enterValue("0.000001");
    await depositModal.waitForProgressBar();

    await depositModal.waitForContinueState(false);
    const isContinueButtonEnabled =
      await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeFalsy();
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
