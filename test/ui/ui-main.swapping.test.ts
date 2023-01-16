/* eslint-disable no-console */
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { WalletConnectModal } from "../../utils/frontend/pages/WalletConnectModal";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  acceptPermissionsPolkadotExtension,
  setupPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Swap } from "../../utils/frontend/pages/Swap";
import {
  MGA_ASSET_ID,
  MGA_ASSET_NAME,
} from "../../utils/Constants";
import {
  ModalType,
  NotificationModal,
} from "../../utils/frontend/pages/NotificationModal";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { waitNewBlock } from "../../utils/eventListeners";
import {
  createAssetIfMissing,
  createPoolIfMissing,
} from "../../utils/tx";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Node } from "../../utils/Framework/Node/Node";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
process.env.NODE_ENV = "test";
let sudo: SudoUser;
let testUser1: User;
let testAssetName = "TST2";

describe("Boostrap - testpad", () => {
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
    const { mnemonic } = await setupPolkadotExtension(driver);
    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    const testAssetId = await createAssetIfMissing(sudo, testAssetName);
    await createPoolIfMissing(sudo, "100000", MGA_ASSET_ID, testAssetId);

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(new BN(7), testUser1), // transferAll test
      Assets.mintToken(testAssetId, testUser1), // transferAll test
      Assets.mintNative(testUser1)
    );
  });

  test("test1", async () => {
    await getApi();

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

    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.toggleShowAllTokens();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(testAssetName);
    await swapView.addPayAssetAmount("0.01");
    await swapView.doSwap();
    const modal = new NotificationModal(driver);
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    const visible: boolean[] = [];
    for (let index = 0; index < 4; index++) {
      visible.push(await modal.isModalVisible(ModalType.Progress));
      await waitNewBlock();
    }
    expect(
      visible.some((visibleInBlock) => visibleInBlock === true)
    ).toBeTruthy();
    await modal.waitForModalState(ModalType.Success);
    const isModalSuccessVisible = await modal.isModalVisible(ModalType.Success);
    expect(isModalSuccessVisible).toBeTruthy();
    await modal.clickInDone();
  });
});
