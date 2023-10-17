/*
 *
 * @group prodUiSmoke
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
import {
  MGA_ASSET_ID,
  TUR_ASSET_ID,
  TUR_ASSET_NAME,
} from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import { connectPolkadotWallet } from "../../utils/frontend/utils/Handlers";
import { DepositModal } from "../../utils/frontend/pages/DepositModal";

import "dotenv/config";
import { Swap } from "../../utils/frontend/pages/Swap";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;
const KSM_ASSET_NAME = "KSM";
const MGX_ASSET_NAME = "MGX";

describe("UI prod smoke tests - no action", () => {
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

    testUser1.addAsset(TUR_ASSET_ID);
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

  test("Sidebar elements", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    const areSidebarElementsVisible = await sidebar.areSidebarElementsVisible();
    expect(areSidebarElementsVisible).toBeTruthy();
    const mgxTokenAmount = await sidebar.getTokenAmount(MGX_ASSET_NAME, 12000);
    expect(parseFloat(mgxTokenAmount.replace(",", ""))).toBeGreaterThan(1);
    const turTokenAmount = await sidebar.getTokenAmount(TUR_ASSET_NAME, 5000);
    expect(parseFloat(turTokenAmount.replace(",", ""))).toBeGreaterThan(1);

    const isPoolsOverviewItemVisible = await sidebar.isLiquidityPoolVisible(
      MGX_ASSET_NAME,
      TUR_ASSET_NAME,
    );
    expect(isPoolsOverviewItemVisible).toBeTruthy();
  });

  test("User can swap two assets", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.toggleShowAllTokens();
    await swapView.selectPayAsset(MGX_ASSET_NAME);
    await swapView.selectGetAsset(TUR_ASSET_NAME);
    await swapView.addPayAssetAmount("0.001");
    await swapView.waitForProgressBar();
    const isSwapEnabled = await swapView.isSwapEnabled();
    expect(isSwapEnabled).toBeTruthy();
  });

  test("Deposit modal - not enough assets", async () => {
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
