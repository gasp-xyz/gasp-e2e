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
  let i = 1;
  do {
    await chainOne.chain.newBlock();
    await chainTwo.chain.newBlock();
    i++;
  } while (i < numOfBLocks);

  // pushing last block instructions for concurrent run along with toast wait
  // this is required to make sure driver will in time check the toast
  const promises = [];
  promises.push(chainOne.chain.newBlock());
  promises.push(chainTwo.chain.newBlock());
  promises.push(toast.waitForToastState(ToastType.Success, transaction));
  await Promise.all(promises);
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
