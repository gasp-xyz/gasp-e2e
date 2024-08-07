/*
 *
 * @group microappsDeposit
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { KSM_ASSET_ID, GASP_ASSET_ID } from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForMicroappsActionNotification,
} from "../../utils/frontend/microapps-utils/Handlers";
import { DepositModal } from "../../utils/frontend/microapps-pages/DepositModal";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { connectVertical } from "@acala-network/chopsticks";
import { devTestingPairs } from "../../utils/setup";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "gasp-sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const KSM_ASSET_NAME = "KSM";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const INIT_KSM_RELAY = 15;

describe("Microapps UI deposit modal tests", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama({ localPort: 9944 });
    mangata = await XcmNetworks.mangata({ localPort: 9946 });
    await connectVertical(kusama.chain, mangata.chain);
    alice = devTestingPairs().alice;
    StashServiceMockSingleton.getInstance().startMock();

    try {
      getApi();
    } catch (e) {
      await initApi();
    }

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
    testUser1.addAsset(GASP_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
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
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.Deposit,
      2,
    );
  });

  test("Deposit - input null values", async () => {
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
    await depositModal.enterValue("0");
    let isContinueButtonEnabled = await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeFalsy();

    await depositModal.enterValue("0.00");
    isContinueButtonEnabled = await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeFalsy();

    await depositModal.enterValue("000.00");
    isContinueButtonEnabled = await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeFalsy();

    const isErrorMessage = await depositModal.isErrorMessage();
    expect(isErrorMessage).toBeFalsy();

    await depositModal.enterValue("0.01");

    await depositModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await depositModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();
    const isDestinationFeeDisplayed =
      await depositModal.isDestinationFeeDisplayed();
    expect(isDestinationFeeDisplayed).toBeTruthy();

    isContinueButtonEnabled = await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeTruthy();
  });

  test("Deposit - input errors", async () => {
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
    await depositModal.enterValue("1000");
    let isContinueButtonEnabled = await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeFalsy();

    let isErrorMessage = await depositModal.isErrorMessage();
    expect(isErrorMessage).toBeTruthy();

    await depositModal.enterValue("0.0000001");
    isContinueButtonEnabled = await depositModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeFalsy();

    isErrorMessage = await depositModal.isErrorMessage();
    expect(isErrorMessage).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    StashServiceMockSingleton.getInstance().stopServer();
    await kusama.teardown();
    await mangata.teardown();
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
