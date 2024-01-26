/*
 *
 * @group microappsAccounts
 */
import { jest } from "@jest/globals";
import { KeyringPair } from "@polkadot/keyring/types";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { getEnvironmentRequiredVars } from "../../utils/utils";
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
import { ApiContext, upgradeMangata } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { connectVertical } from "@acala-network/chopsticks";
import { devTestingPairs } from "../../utils/setup";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";
import { WithdrawModal } from "../../utils/frontend/microapps-pages/WithdrawModal";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import { LiqPools } from "../../utils/frontend/microapps-pages/LiqPools";
import { LiqPoolDetils } from "../../utils/frontend/microapps-pages/LiqPoolDetails";
import { Swap } from "../../utils/frontend/microapps-pages/Swap";
import {
  INIT_KSM_RELAY,
  KSM_ASSET_NAME,
  KSM_FULL_NAME,
  MGX_ASSET_NAME,
} from "../../utils/frontend/microapps-pages/UiConstant";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let driver: WebDriver;
let kusama: ApiContext;
let mangata: ApiContext;

const accountName = "acc_automation";
const { mnemonicPolkadotEd25519, mnemonicPolkadotEcdsa } =
  getEnvironmentRequiredVars();

beforeAll(async () => {
  kusama = await XcmNetworks.kusama({ localPort: 9944 });
  mangata = await XcmNetworks.mangata({ localPort: 9946 });
  await connectVertical(kusama.chain, mangata.chain);
  StashServiceMockSingleton.getInstance().startMock();
});

describe.each`
  userAddressString                                     | mnemonicKey                | accType
  ${"5HRSqs882zwRmzY3zyXVFrWim6aMKS2c7a35zdAwWpjp9SVi"} | ${mnemonicPolkadotEcdsa}   | ${"ecdsa"}
  ${"5CowkvkRjFgffQ2Nb7W5mv1e5Ee7fujmtX9db4hnfPZV8jnf"} | ${mnemonicPolkadotEd25519} | ${"ed25519"}
`(
  "Microapps UI alternative accounts tests",
  ({ userAddressString, mnemonicKey, accType }) => {
    let alice: KeyringPair;
    const userAddress = userAddressString;

    beforeAll(async () => {
      alice = devTestingPairs().alice;

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
          Key: alice.address,
        },
      });
      await kusama.dev.setStorage({
        System: {
          Account: [
            [
              [userAddress],
              { providers: 1, data: { free: INIT_KSM_RELAY * 1e12 } },
            ],
            [[alice.address], { providers: 1, data: { free: 10 * 1e12 } }],
          ],
        },
      });
      await upgradeMangata(mangata);
      driver = await DriverBuilder.getInstance();
      await importPolkadotExtension(driver, mnemonicKey);

      const node = new Node(getEnvironmentRequiredVars().chainUri);
      await node.connect();

      await setupPage(driver);
      await connectWallet(driver, "Polkadot", accountName);
    });

    test("Swap tokens by account type " + accType, async () => {
      await setupPageWithState(driver, accountName);
      const swap = new Swap(driver);
      const isSwapFrameDisplayed = await swap.isDisplayed();
      expect(isSwapFrameDisplayed).toBeTruthy();
      await swap.pickPayToken(MGX_ASSET_NAME);
      await swap.pickGetToken(KSM_FULL_NAME);
      await swap.setPayTokenAmount("10");
      const getTokenAmount = await swap.fetchGetAssetAmount();
      expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

      await swap.waitForSwapButtonEnabled();
      const isSwapEnabled = await swap.isSwapButtonEnabled();
      expect(isSwapEnabled).toBeTruthy();
      await swap.clickSwapButton();
      await waitForMicroappsActionNotification(
        driver,
        mangata,
        kusama,
        TransactionType.Swap,
        2,
      );
    });

    test("Add MGX-KSM pool liquidity by account type " + accType, async () => {
      await setupPageWithState(driver, accountName);
      const sidebar = new Sidebar(driver);
      await sidebar.clickNavLiqPools();

      const poolsList = new LiqPools(driver);
      const isPoolsListDisplayed = await poolsList.isDisplayed();
      expect(isPoolsListDisplayed).toBeTruthy();

      const isMgxKsmPoolVisible = await poolsList.isPoolItemDisplayed(
        "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
      );
      expect(isMgxKsmPoolVisible).toBeTruthy();
      await poolsList.clickPoolItem(
        "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
      );

      const poolDetails = new LiqPoolDetils(driver);
      const isPoolDetailsVisible = await poolDetails.isDisplayed(
        MGX_ASSET_NAME + " / " + KSM_ASSET_NAME,
      );
      expect(isPoolDetailsVisible).toBeTruthy();
      const poolShareBefore = await poolDetails.getMyPositionAmount();

      await poolDetails.clickAddLiquidity();
      const isFirstTokenNameSet =
        await poolDetails.isFirstTokenNameSet(MGX_ASSET_NAME);
      expect(isFirstTokenNameSet).toBeTruthy();
      const isSecondTokenNameSet =
        await poolDetails.isSecondTokenNameSet(KSM_ASSET_NAME);
      expect(isSecondTokenNameSet).toBeTruthy();

      await poolDetails.setFirstTokenAmount("1");
      await poolDetails.waitForContinueState(true, 5000);
      const secondTokenAmount = await poolDetails.getSecondTokenAmount();
      expect(secondTokenAmount).toBeGreaterThan(0);

      const isExpectedShareDisplayed =
        await poolDetails.isExpectedShareDisplayed();
      expect(isExpectedShareDisplayed).toBeTruthy();
      const isFeeDisplayed = await poolDetails.isFeeDisplayed();
      expect(isFeeDisplayed).toBeTruthy();
      const isEstRewardDisplayed = await poolDetails.isEstRewardDisplayed();
      expect(isEstRewardDisplayed).toBeTruthy();

      await poolDetails.submit();
      await waitForMicroappsActionNotification(
        driver,
        mangata,
        kusama,
        TransactionType.AddLiquidity,
        2,
      );

      const poolShareAfter = await poolDetails.getMyPositionAmount();
      expect(poolShareAfter).toBeGreaterThan(poolShareBefore);
    });

    test("Deposit tokens by account type " + accType, async () => {
      await setupPageWithState(driver, accountName);

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

    test("Withdraw tokens by account type " + accType, async () => {
      await setupPageWithState(driver, accountName);

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
      await waitForMicroappsActionNotification(
        driver,
        mangata,
        kusama,
        TransactionType.Withdraw,
        4,
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
      const api = getApi();
      await api.disconnect();
      await driver.quit();
      DriverBuilder.destroy();
    });
  },
);

afterAll(async () => {
  StashServiceMockSingleton.getInstance().stopServer();
  await kusama.teardown();
  await mangata.teardown();
});
