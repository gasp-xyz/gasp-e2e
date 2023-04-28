/*
 *
 * @group uiXcm
 */
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
import { setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Node } from "../../utils/Framework/Node/Node";
import {
  connectPolkadotWallet,
  waitForActionNotification,
} from "../../utils/frontend/utils/Handlers";
import { DepositModal } from "../../utils/frontend/pages/DepositModal";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let sudo: SudoUser;
let testUser1: User;

describe("UI XCM tests - KSM", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    sudo = new SudoUser(keyring, node);
    keyring.addPair(sudo.keyRingPair);
    await setupApi();
    await setupUsers();
    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);
    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(
      keyring,
      getEnvironmentRequiredVars().mnemonicPolkadot
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("Deposit", async () => {
    getApi();
    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await connectPolkadotWallet(driver, sidebar, mga);
    const isWalletConnected = sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    await sidebar.clickOnDepositToMangata();

    const depositModal = new DepositModal(driver);
    let isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openTokensList();
    const areTokenListElementsVisible =
      await depositModal.areTokenListElementsVisible("KSM");
    expect(areTokenListElementsVisible).toBeTruthy();
    const tokensBefore = await depositModal.getTokenAmount("KSM");
    await depositModal.selectToken("KSM");
    await depositModal.enterValue("1");
    await depositModal.clickContinue();

    await waitForActionNotification(driver);

    await sidebar.clickOnDepositToMangata();
    isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openTokensList();
    const tokensAfter = await depositModal.getTokenAmount("KSM");
    expect(tokensAfter).toBeLessThan(tokensBefore);
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
    await driver.manage().deleteAllCookies();
    await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
  });

  afterAll(async () => {
    await driver.quit();
    DriverBuilder.destroy();
    const api = getApi();
    await api.disconnect();
  });
});
