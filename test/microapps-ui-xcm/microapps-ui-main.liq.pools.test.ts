/*
 *
 * @group microappsPools
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { Node } from "../../utils/Framework/Node/Node";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { FIVE_MIN, KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForMicroappsActionNotification,
} from "../../utils/frontend/microapps-utils/Handlers";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import { connectVertical } from "@acala-network/chopsticks";
import { BN_TEN_THOUSAND, BN_THOUSAND } from "@mangata-finance/sdk";
import { AssetId } from "../../utils/ChainSpecs";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs } from "../../utils/setup";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { LiqPools } from "../../utils/frontend/microapps-pages/LiqPools";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import { LiqPoolDetils } from "../../utils/frontend/microapps-pages/LiqPoolDetails";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";
import {
  NotificationToast,
  ToastType,
} from "../../utils/frontend/microapps-pages/NotificationToast";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const KSM_ASSET_NAME = "KSM";
const MGX_ASSET_NAME = "MGX";
const TUR_ASSET_NAME = "TUR";
const ZLK_ASSET_NAME = "ZLK";

describe("Miocroapps UI liq pools tests", () => {
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
          [[userAddress, { token: 7 }], { free: 10 * 1e10 }],
          [
            [userAddress, { token: 26 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_TEN_THOUSAND).toString() },
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

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("User can enter MGX-KSM pool details", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    const isMgxKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isMgxKsmPoolVisible).toBeTruthy();
    await poolsList.clickPoolItem("-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME);

    const poolDetails = new LiqPoolDetils(driver);
    const isPoolDetailsVisible = await poolDetails.isDisplayed(
      MGX_ASSET_NAME + " / " + KSM_ASSET_NAME,
    );
    expect(isPoolDetailsVisible).toBeTruthy();

    const arePositionDetailsVisible =
      await poolDetails.arePositionDetialsDisplayed();
    expect(arePositionDetailsVisible).toBeTruthy();
    const isPoolHistoryDisplayed = await poolDetails.isPoolHistoryDisplayed();
    expect(isPoolHistoryDisplayed).toBeTruthy();
    const arePoolStatsDisplayed = await poolDetails.arePoolStatsDisplayed();
    expect(arePoolStatsDisplayed).toBeTruthy();
  });

  it("User can search pools list", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    let isMgxKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isMgxKsmPoolVisible).toBeTruthy();

    await poolsList.openSearch();
    await poolsList.inputSearch("TUR");

    isMgxKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isMgxKsmPoolVisible).toBeFalsy();

    const isTurMgxPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + TUR_ASSET_NAME + "-" + MGX_ASSET_NAME,
    );
    expect(isTurMgxPoolVisible).toBeTruthy();
  });

  it("User can switch filtering between promoted or all pools", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();
    await poolsList.clickAllPoolsTab();
    await driver.sleep(1500);
    
    let isTurKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + TUR_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isTurKsmPoolVisible).toBeTruthy();

    await poolsList.clickPromotedPoolsTab();
    isTurKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + TUR_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isTurKsmPoolVisible).toBeFalsy();
  });

  it("Add pool liquidity input values", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    const isMgxKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isMgxKsmPoolVisible).toBeTruthy();
    await poolsList.clickPoolItem("-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME);

    const poolDetails = new LiqPoolDetils(driver);
    const isPoolDetailsVisible = await poolDetails.isDisplayed(
      MGX_ASSET_NAME + " / " + KSM_ASSET_NAME,
    );
    expect(isPoolDetailsVisible).toBeTruthy();

    await poolDetails.clickAddLiquidity();
    const isFirstTokenNameSet =
      await poolDetails.isFirstTokenNameSet(MGX_ASSET_NAME);
    expect(isFirstTokenNameSet).toBeTruthy();
    const isSecondTokenNameSet =
      await poolDetails.isSecondTokenNameSet(KSM_ASSET_NAME);
    expect(isSecondTokenNameSet).toBeTruthy();

    // only second token value set by user
    await poolDetails.setSecondTokenAmount("0.01");
    await poolDetails.waitFirstTokenAmountSet(true);
    await driver.sleep(500);
    const firstTokenAmount = await poolDetails.getFirstTokenAmount();
    expect(firstTokenAmount).toBeGreaterThan(0);
    await driver.sleep(500);
  });

  it("Add MGX-KSM pool liquidity", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    let isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    const isMgxKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isMgxKsmPoolVisible).toBeTruthy();
    await poolsList.clickPoolItem("-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME);

    const poolDetails = new LiqPoolDetils(driver);
    const isPoolDetailsVisible = await poolDetails.isDisplayed(
      MGX_ASSET_NAME + " / " + KSM_ASSET_NAME,
    );
    expect(isPoolDetailsVisible).toBeTruthy();
    const my_pool_share = await poolDetails.getMyPositionAmount();

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
    await poolDetails.waitForContinueState(false, 5000);
    const toast = new NotificationToast(driver);
    await toast.waitForToastDisappear(
      ToastType.Success,
      TransactionType.AddLiquidity,
    );
    await poolDetails.clickBackButton();
    isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();
    await poolsList.clickPoolItem("-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME);

    const my_new_pool_share = await poolDetails.getMyPositionAmount();
    expect(my_new_pool_share).toBeGreaterThan(my_pool_share);
  });

  it("User can create new liquidity pool", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    let isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();
    await poolsList.clickAllPoolsTab();
    await poolsList.clickCreateLiquidity();
    await poolsList.pickFirstToken(TUR_ASSET_NAME);
    await poolsList.pickSecondToken(ZLK_ASSET_NAME);
    await poolsList.setFirstTokenAmount("2");
    await poolsList.setSecondTokenAmount("1");

    await poolsList.waitForContinueState(true);
    const isExpectedShareDisplayed = await poolsList.isExpectedShareDisplayed();
    expect(isExpectedShareDisplayed).toBeTruthy();
    const isFeeDisplayed = await poolsList.isFeeDisplayed();
    expect(isFeeDisplayed).toBeTruthy();

    await poolsList.waitForContinueState(true, 5000);
    await poolsList.createLiqPoolsubmit();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.CreatePool,
      2,
    );
    await poolsList.clickCancelButton();
    isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();
    await poolsList.clickPoolItem("-" + ZLK_ASSET_NAME + "-" + TUR_ASSET_NAME);

    const poolDetails = new LiqPoolDetils(driver);
    const isPoolDetailsVisible = await poolDetails.isDisplayed(
      ZLK_ASSET_NAME + " / " + TUR_ASSET_NAME,
    );
    expect(isPoolDetailsVisible).toBeTruthy();
    const isMyPositionAmountDisplayed =
      await poolDetails.isMyPositionAmountDisplayed();
    expect(isMyPositionAmountDisplayed).toBeTruthy();
    const my_pool_share = await poolDetails.getMyPositionAmount();
    expect(my_pool_share).toBeGreaterThan(0);
  });

  it("User can add liquidity from create liquidity widget", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();
    await poolsList.clickAllPoolsTab();
    await poolsList.clickCreateLiquidity();
    await poolsList.pickFirstToken(MGX_ASSET_NAME);
    await poolsList.pickSecondToken(TUR_ASSET_NAME);
    const isPoolExistsInfoDisplayed =
      await poolsList.isPoolExistsInfoDisplayed();
    expect(isPoolExistsInfoDisplayed).toBeTruthy();

    await poolsList.setFirstTokenAmount("10");
    await poolsList.waitForContinueState(true);
    const isExpectedShareDisplayed = await poolsList.isExpectedShareDisplayed();
    expect(isExpectedShareDisplayed).toBeTruthy();
    const isFeeDisplayed = await poolsList.isFeeDisplayed();
    expect(isFeeDisplayed).toBeTruthy();
    const isEstRewardDisplayed = await poolsList.isEstRewardDisplayed();
    expect(isEstRewardDisplayed).toBeTruthy();
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
