import { WebDriver } from "selenium-webdriver";
import { ApiContext } from "../../Framework/XcmHelper";
import { Main } from "../microapps-pages/Main";
import { WalletConnectModal } from "../microapps-pages/WalletConnectModal";
import { WalletWrapper } from "../microapps-pages/WalletWrapper";
import { Polkadot } from "../pages/Polkadot";
import { acceptPermissionsWalletExtensionInNewWindow } from "../utils/Helper";
import { BN_TEN } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import {
  NotificationToast,
  ToastType,
  TransactionType,
} from "../microapps-pages/NotificationToast";

export async function connectWallet(
  driver: WebDriver,
  walletType: string,
  acc_name: string,
) {
  const walletWrapper = new WalletWrapper(driver);
  const isWalletButton = await walletWrapper.isWalletConnectButtonDisplayed();
  expect(isWalletButton).toBeTruthy();

  await walletWrapper.openWalletConnectionInfo();
  let isWalletConnected = await walletWrapper.isWalletConnected();
  expect(isWalletConnected).toBeFalsy();

  await walletWrapper.clickWalletConnect();
  await walletWrapper.pickWallet(walletType);

  const walletConnectModal = new WalletConnectModal(driver);
  let isWalletConnectModalDisplayed = await walletConnectModal.displayed();
  expect(isWalletConnectModalDisplayed).toBeTruthy();

  await acceptPermissionsWalletExtensionInNewWindow(driver, walletType);

  const areAccountsDisplayed = await walletConnectModal.accountsDisplayed();
  expect(areAccountsDisplayed).toBeTruthy();

  await walletConnectModal.pickAccount(acc_name);
  isWalletConnectModalDisplayed = await walletConnectModal.displayed();
  expect(isWalletConnectModalDisplayed).toBeFalsy();

  isWalletConnected = await walletWrapper.isWalletConnected();
  expect(isWalletConnected).toBeTruthy();
}

export async function setupPage(driver: WebDriver) {
  const mainPage = new Main(driver);
  await mainPage.go();
  const appLoaded = await mainPage.isAppLoaded();
  expect(appLoaded).toBeTruthy();
  await mainPage.skipBetaInfo();
}

export async function setupPageWithState(driver: WebDriver, acc_name: string) {
  const mainPage = new Main(driver);
  await mainPage.go();
  const appLoaded = await mainPage.isAppLoaded();
  expect(appLoaded).toBeTruthy();

  const walletWrapper = new WalletWrapper(driver);
  const isAccInfoDisplayed = await walletWrapper.isAccInfoDisplayed(acc_name);
  expect(isAccInfoDisplayed).toBeTruthy();
}

export async function waitForMicroappsActionNotification(
  driver: WebDriver,
  chainOne: ApiContext,
  chainTwo: ApiContext,
  transaction: TransactionType,
  numOfBLocks = 1,
) {
  const toast = new NotificationToast(driver);
  await toast.waitForToastState(ToastType.Confirm, transaction, 3000);
  const isModalWaitingForSignVisible = await toast.istoastVisible(
    ToastType.Confirm,
    transaction,
  );
  expect(isModalWaitingForSignVisible).toBeTruthy();
  await Polkadot.signTransaction(driver);
  const promises = [];
  promises.push(chainOne.chain.newBlock());
  promises.push(chainTwo.chain.newBlock());
  let i = 1;
  do {
    const INTERVAL = 2000;
    promises.push(delayedNewBlock(chainOne, i * INTERVAL));
    promises.push(delayedNewBlock(chainTwo, i * INTERVAL + 1000));
    i++;
  } while (i < numOfBLocks);
  promises.push(toast.waitForToastState(ToastType.Success, transaction));
  await Promise.all(promises);
}

async function delayedNewBlock(chainName: ApiContext, delayMs: number) {
  await delay(delayMs);
  return chainName.chain.newBlock();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function addLiqTokenMicroapps(
  userAddress: string,
  apiContext: ApiContext,
  tokenId: number,
  power: number,
  value: number,
) {
  await apiContext.dev.setStorage({
    Tokens: {
      Accounts: [
        [
          [userAddress, { token: tokenId }],
          { free: BN_TEN.pow(new BN(power)).mul(new BN(value)).toString() },
        ],
      ],
    },
  });
}
