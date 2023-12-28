import { WebDriver } from "selenium-webdriver";
import { ApiContext } from "../../Framework/XcmHelper";
import { DepositModal } from "../pages/DepositModal";
import { Mangata } from "../pages/Mangata";
import { ModalType, NotificationModal } from "../pages/NotificationModal";
import { Polkadot } from "../pages/Polkadot";

import { Sidebar } from "../pages/Sidebar";
import { TokensModal } from "../pages/TokensModal";
import { WalletConnectModal } from "../pages/WalletConnectModal";
import { WithdrawModal } from "../pages/WithdrawModal";
import { acceptPermissionsPolkadotExtension } from "./Helper";

export async function connectPolkadotWallet(
  driver: WebDriver,
  sidebar: Sidebar,
  mga: Mangata,
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
  mga: Mangata,
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
  chainOne: ApiContext,
  numOfBLocks = 1,
) {
  const modal = new NotificationModal(driver);
  await modal.waitForModalState(ModalType.Confirm, 3000);
  const isModalWaitingForSignVisible = await modal.isModalVisible(
    ModalType.Confirm,
  );
  expect(isModalWaitingForSignVisible).toBeTruthy();
  await Polkadot.signTransaction(driver);
  for (let i = 0; i < numOfBLocks; i++) {
    await chainOne.chain.newBlock();
  }
  await modal.waitForModalState(ModalType.Success);
  const isModalSuccessVisible = await modal.isModalVisible(ModalType.Success);
  expect(isModalSuccessVisible).toBeTruthy();
  await modal.clickInDone();
}

export async function initWithdraw(driver: WebDriver, assetName: string) {
  const withdrawModal = new WithdrawModal(driver);
  const isWithdrawModalVisible = await withdrawModal.isModalVisible();
  expect(isWithdrawModalVisible).toBeTruthy();

  await withdrawModal.openTokensList();

  const tokenModal = new TokensModal(driver);
  const isTokenModalVisible = await tokenModal.isModalVisible();
  expect(isTokenModalVisible).toBeTruthy();
  const areTokenListElementsVisible =
    await tokenModal.areTokenListElementsVisible(assetName);
  expect(areTokenListElementsVisible).toBeTruthy();

  await tokenModal.selectToken(assetName);
  await withdrawModal.enterValue("1");
  await withdrawModal.clickContinue();
}

export async function initDeposit(driver: WebDriver, assetName: string) {
  const depositModal = new DepositModal(driver);
  const isModalVisible = await depositModal.isModalVisible();
  expect(isModalVisible).toBeTruthy();

  await depositModal.openTokensList();
  const areTokenListElementsVisible =
    await depositModal.areTokenListElementsVisible(assetName);
  expect(areTokenListElementsVisible).toBeTruthy();
  await depositModal.selectToken(assetName);
  await depositModal.enterValue("1");
  await depositModal.waitForProgressBar();
  await depositModal.clickContinue();
}
