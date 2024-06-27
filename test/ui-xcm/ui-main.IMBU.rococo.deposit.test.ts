/*
 *
 * @group uiXcmIMBUrococo
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
import { IMBU_ASSET_NAME, GASP_ASSET_ID } from "../../utils/Constants";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Node } from "../../utils/Framework/Node/Node";
import {
  connectPolkadotWallet,
  waitForActionNotification,
} from "../../utils/frontend/utils/Handlers";
import { DepositModal } from "../../utils/frontend/pages/DepositModal";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import { connectParachains } from "@acala-network/chopsticks";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let sudo: SudoUser;
let testUser1: User;
const userAddress = "5EekB3dsQ4yW6WukZRL5muXb4qKvJMpJdXW3w59SptYHBkvk";

describe("UI XCM tests - IMBU rococo", () => {
  let mangata: ApiContext;
  let imbue: ApiContext;
  let alice: KeyringPair;
  const imbueTokenId = 14;

  beforeAll(async () => {
    mangata = await XcmNetworks.mangata({
      endpoint: "wss://collator-01-ws-rococo.mangata.online",
      localPort: 9946,
    });
    imbue = await XcmNetworks.imbue({
      endpoint: "wss://rococo.imbue.network",
      localPort: 9947,
    });
    await connectParachains([imbue.chain, mangata.chain]);
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
          [[userAddress, { token: imbueTokenId }], { free: 1000e12 }],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
          [[alice.address, { token: imbueTokenId }], { free: 1000e12 }],
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
    await imbue.dev.setStorage({
      System: {
        Account: [[[userAddress], { data: { free: 10e12 } }]],
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

    testUser1.addAsset(imbueTokenId);
    testUser1.addAsset(GASP_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("Deposit", async () => {
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
    const tokenOnAppBefore = await sidebar.getTokenAmount(IMBU_ASSET_NAME);

    await sidebar.clickOnDepositToMangata();

    const depositModal = new DepositModal(driver);
    let isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openTokensList();
    const areTokenListElementsVisible =
      await depositModal.areTokenListElementsVisible(IMBU_ASSET_NAME);
    expect(areTokenListElementsVisible).toBeTruthy();
    const tokensAtSourceBefore =
      await depositModal.getTokenAmount(IMBU_ASSET_NAME);
    await depositModal.selectToken(IMBU_ASSET_NAME);
    await depositModal.enterValue("1");
    await depositModal.waitForProgressBar();
    await depositModal.clickContinue();

    await waitForActionNotification(driver, mangata);

    await imbue.chain.newBlock();
    await sidebar.clickOnDepositToMangata();
    isModalVisible = await depositModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await depositModal.openTokensList();
    const tokensAtSourceAfter =
      await depositModal.getTokenAmount(IMBU_ASSET_NAME);
    expect(tokensAtSourceAfter).toBeLessThan(tokensAtSourceBefore);

    await mangata.chain.newBlock();

    await mga.go();
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    expect(testUser1.getAsset(imbueTokenId)?.amountBefore.free!).bnLt(
      testUser1.getAsset(imbueTokenId)?.amountAfter.free!,
    );
    await sidebar.waitForLoad();
    const tokenOnAppAfter = await sidebar.getTokenAmount(IMBU_ASSET_NAME);
    expect(parseFloat(tokenOnAppAfter.replace(",", ""))).toBeGreaterThan(
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
