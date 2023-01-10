/*
 *
 * @group ui
 * @group ui-smoke
 */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";

import { Mangata } from "../../utils/frontend/pages/Mangata";

import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  setupPolkadotExtension,
  acceptPermissionsPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";

import { FIVE_MIN, MGA_ASSET_ID, TUR_ASSET_ID } from "../../utils/Constants";
import { testLog } from "../../utils/Logger";
import { Node } from "../../utils/Framework/Node/Node";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { WalletConnectModal } from "../../utils/frontend/pages/WalletConnectModal";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can swap and mint tokens", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: SudoUser;
  const visibleValueNumber = Math.pow(10, 19).toString();

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    driver = await DriverBuilder.getInstance();

    const { mnemonic } = await setupPolkadotExtension(driver);

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    sudo = new SudoUser(keyring, node);

    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(visibleValueNumber));
    await sudo.mint(
      TUR_ASSET_ID,
      testUser1,
      new BN((parseInt(visibleValueNumber) / 100000).toString())
    );
    // await createPoolIfMissing(
    //   sudo,
    //   visibleValueNumber,
    //   MGA_ASSET_ID,
    //   TUR_ASSET_ID
    // );
    // testUser1.addAsset(MGA_ASSET_ID);
    // testUser1.addAsset(TUR_ASSET_ID);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await sidebar.clickOnWalletConnect();
    const walletConnectModal = new WalletConnectModal(driver);
    const isWalletConnectModalDisplayed = await walletConnectModal.opens();
    expect(isWalletConnectModalDisplayed).toBeTruthy();
    await walletConnectModal.pickWallet("Polkadot");
    await acceptPermissionsPolkadotExtension(driver);
    await mga.go();
    await sidebar.clickOnWalletConnect();
    await walletConnectModal.pickWallet("Polkadot");
    await walletConnectModal.pickAccount("acc_automation");
    const isWalletConnected = sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();
  });

  afterEach(async () => {
    try {
      const session = await driver.getSession();
      await addExtraLogs(
        driver,
        expect.getState().currentTestName + " - " + session.getId()
      );
    } catch (error) {
      testLog.getLog().warn(error);
    } finally {
      await driver.quit();
      await DriverBuilder.destroy();
    }
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
  });
});
