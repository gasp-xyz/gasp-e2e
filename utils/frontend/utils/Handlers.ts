import { WebDriver } from "selenium-webdriver";
import { Mangata } from "../pages/Mangata";

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