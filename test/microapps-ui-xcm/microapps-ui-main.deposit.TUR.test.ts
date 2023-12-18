/*
 *
 * @group microappsTransferTUR
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
import { MGA_ASSET_ID, TUR_ASSET_ID } from "../../utils/Constants";
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
import { BuildBlockMode, connectParachains } from "@acala-network/chopsticks";
import { devTestingPairs } from "../../utils/setup";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import {
  ModalType,
  NotificationModal,
  TransactionType,
} from "../../utils/frontend/microapps-pages/NotificationModal";
import { WithdrawModal } from "../../utils/frontend/microapps-pages/WithdrawModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const TUR_ASSET_NAME = "TUR";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";

describe("Microapps UI TUR transfer tests", () => {
  let mangata: ApiContext;
  let turing: ApiContext;
  let alice: KeyringPair;

  beforeAll(async () => {
    mangata = await XcmNetworks.mangata({
      buildBlockMode: BuildBlockMode.Instant,
      localPort: 9946,
    });
    turing = await XcmNetworks.turing({
      buildBlockMode: BuildBlockMode.Instant,
      localPort: 9948,
    });
    await connectParachains([turing.chain, mangata.chain]);
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
          [[userAddress, { token: 7 }], { free: 1000e10 }],
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

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  test("Withdraw - enough assets", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openWithdraw();
    const withdrawModal = new WithdrawModal(driver);
    const isModalVisible = await withdrawModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await withdrawModal.openChainList();
    await withdrawModal.selectChain("Turing");
    await withdrawModal.openTokensList();
    await withdrawModal.waitForTokenListElementsVisible(TUR_ASSET_NAME);
    await withdrawModal.selectToken(TUR_ASSET_NAME);
    await withdrawModal.enterValue("100");

    await withdrawModal.waitForContinueState(true, 60000);
    const isOriginFeeDisplayed = await withdrawModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();
    const isDestinationFeeDisplayed =
      await withdrawModal.isDestinationFeeDisplayed();
    expect(isDestinationFeeDisplayed).toBeTruthy();

    const isContinueButtonEnabled =
      await withdrawModal.isContinueButtonEnabled();
    expect(isContinueButtonEnabled).toBeTruthy();

    await withdrawModal.clickContinue();

    const modal = new NotificationModal(driver);
    await modal.waitForModalState(
      ModalType.Confirm,
      TransactionType.Withdraw,
      3000,
    );
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm,
      TransactionType.Withdraw,
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      turing,
      TransactionType.Withdraw,
      4,
    );
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
    await depositModal.selectChain("Turing");
    await depositModal.openTokensList();
    await depositModal.waitForTokenListElementsVisible(TUR_ASSET_NAME);
    await depositModal.selectToken(TUR_ASSET_NAME);
    await depositModal.enterValue("10");

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
      turing,
      TransactionType.Deposit,
      2,
    );
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
    await turing.teardown();
    await mangata.teardown();
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
