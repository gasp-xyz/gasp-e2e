import { WebDriver } from "selenium-webdriver";
import { ApiContext } from "../../Framework/XcmHelper";
import { Mangata } from "../pages/Mangata";
import { ModalType, NotificationModal } from "../pages/NotificationModal";
import { Polkadot } from "../pages/Polkadot";

import { Sidebar } from "../pages/Sidebar";
import { WalletConnectModal } from "../pages/WalletConnectModal";
import { acceptPermissionsPolkadotExtension } from "./Helper";

export async function connectPolkadotWallet(
  driver: WebDriver,
  sidebar: Sidebar,
  mga: Mangata
) {
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
}

export async function allowPolkadotWalletConnection(
  driver: WebDriver,
  mga: Mangata
) {
  const walletConnectModal = new WalletConnectModal(driver);
  const isWalletConnectModalDisplayed = await walletConnectModal.opens();
  expect(isWalletConnectModalDisplayed).toBeTruthy();
  await walletConnectModal.pickWallet("Polkadot");
  await acceptPermissionsPolkadotExtension(driver);
  await mga.go();
}

export async function waitForActionNotification(
  driver: WebDriver,
  chainOne: ApiContext
) {
  const modal = new NotificationModal(driver);
  await modal.waitForModalState(ModalType.Confirm, 3000);
  const isModalWaitingForSignVisible = await modal.isModalVisible(
    ModalType.Confirm
  );
  expect(isModalWaitingForSignVisible).toBeTruthy();
  await Polkadot.signTransaction(driver);
  await chainOne.chain.newBlock();
  await modal.waitForModalState(ModalType.Success);
  const isModalSuccessVisible = await modal.isModalVisible(ModalType.Success);
  expect(isModalSuccessVisible).toBeTruthy();
  await modal.clickInDone();
}
