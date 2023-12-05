/*
 *
 * @group microappsProdWithdraw
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";
import { WithdrawModal } from "../../utils/frontend/microapps-pages/WithdrawModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const KSM_ASSET_NAME = "KSM";

describe("Microapps Prod UI withdraw modal tests", () => {

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

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  test("Withdraw - not enough assets", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openWithdraw();
    const withdrawModal = new WithdrawModal(driver);
    const isModalVisible = await withdrawModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await withdrawModal.openChainList();
    await withdrawModal.selectChain("Kusama");
    await withdrawModal.openTokensList();
    await withdrawModal.waitForTokenListElementsVisible(KSM_ASSET_NAME);
    await withdrawModal.selectToken(KSM_ASSET_NAME);
    await withdrawModal.enterValue("1");

    await withdrawModal.waitForContinueState(false, 60000);
    const isOriginFeeDisplayed = await withdrawModal.isOriginFeeDisplayed();
    expect(isOriginFeeDisplayed).toBeTruthy();
    const isDestinationFeeDisplayed =
      await withdrawModal.isDestinationFeeDisplayed();
    expect(isDestinationFeeDisplayed).toBeTruthy();

    const isContinueButtonEnabled =
      await withdrawModal.isContinueButtonEnabled();
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
