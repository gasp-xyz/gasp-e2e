/*
 *
 * @group uiXcmWithdrawKSM
 */
import { jest } from "@jest/globals";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { devTestingPairs, setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { KSM_ASSET_ID, GASP_ASSET_ID } from "../../utils/Constants";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Node } from "../../utils/Framework/Node/Node";
import {
  connectPolkadotWallet,
  initWithdraw,
  waitForActionNotification,
} from "../../utils/frontend/utils/Handlers";
import { DepositModal } from "../../utils/frontend/pages/DepositModal";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import { connectVertical } from "@acala-network/chopsticks";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let sudo: SudoUser;
let testUser1: User;
const userAddress = "5EekB3dsQ4yW6WukZRL5muXb4qKvJMpJdXW3w59SptYHBkvk";
const KSM_ASSET_NAME = "KSM";
const INIT_KSM_RELAY = 15;

describe("UI XCM tests - KSM", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama({ localPort: 9944 });
    mangata = await XcmNetworks.mangata({ localPort: 9946 });
    await connectVertical(kusama.chain, mangata.chain);
    alice = devTestingPairs().alice;

    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[userAddress, { token: 4 }], { free: 10 * 1e12 }],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
          [[alice.address, { token: 4 }], { free: 10 * 1e12 }],
          [
            [alice.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
        ],
      },
      Sudo: {
        Key: userAddress,
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [
          [
            [userAddress],
            { providers: 1, data: { free: INIT_KSM_RELAY * 1e12 } },
          ],
        ],
      },
    });

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
      getEnvironmentRequiredVars().mnemonicPolkadot,
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(GASP_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("Withdraw", async () => {
    getApi();
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
    const tokenOnAppBefore = await sidebar.getTokenAmount(KSM_ASSET_NAME);

    await sidebar.clickOnWithdraw();
    await initWithdraw(driver, KSM_ASSET_NAME);
    await waitForActionNotification(driver, mangata);

    await mangata.chain.newBlock();
    await kusama.chain.newBlock();
    await sidebar.clickOnDepositToMangata();

    const depositModal = new DepositModal(driver);
    const isDepositModalVisible = await depositModal.isModalVisible();
    expect(isDepositModalVisible).toBeTruthy();
    await depositModal.openTokensList();
    const tokensAtDestinationAfter =
      await depositModal.getTokenAmount(KSM_ASSET_NAME);
    expect(tokensAtDestinationAfter).toBeGreaterThan(INIT_KSM_RELAY);

    await mangata.chain.newBlock();

    await mga.go();
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    expect(testUser1.getAsset(KSM_ASSET_ID)?.amountBefore.free!).bnGt(
      testUser1.getAsset(KSM_ASSET_ID)?.amountAfter.free!,
    );
    await sidebar.waitForLoad();
    const tokenOnAppAfter = await sidebar.getTokenAmount(KSM_ASSET_NAME);
    expect(parseFloat(tokenOnAppAfter.replace(",", ""))).toBeLessThan(
      parseFloat(tokenOnAppBefore.replace(",", "")),
    );
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
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
