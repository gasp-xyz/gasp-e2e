/*
 *
 * @group microappsPosition
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
import {
  KSM_ASSET_ID,
  MGA_ASSET_ID,
  TUR_ASSET_NAME,
} from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import {
  addLiqTokenMicroapps,
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForMicroappsActionNotification,
} from "../../utils/frontend/microapps-utils/Handlers";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { connectVertical } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { LiqPools } from "../../utils/frontend/microapps-pages/LiqPools";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import {
  KSM_ASSET_NAME,
  MGX_ASSET_NAME,
} from "../../utils/frontend/microapps-pages/UiConstant";
import { LiqPoolDetils } from "../../utils/frontend/microapps-pages/LiqPoolDetails";
//import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";
import { PositionPageDriver } from "../../utils/frontend/microapps-pages/PositionPage";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const INIT_KSM_RELAY = 15;

describe("Microapps UI Position page tests", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let sidebar: Sidebar;
  let positionPageDriver: PositionPageDriver;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama({ localPort: 9944 });
    mangata = await XcmNetworks.mangata({ localPort: 9946 });
    await connectVertical(kusama.chain, mangata.chain);
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
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
        ],
      },
      Sudo: {
        Key: userAddress,
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [
          [
            [userAddress],
            { providers: 1, data: { free: INIT_KSM_RELAY * 1e12 } },
          ],
        ],
      },
    });

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    sidebar = new Sidebar(driver);
    positionPageDriver = new PositionPageDriver(driver);

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

  it("Add pool liquidity", async () => {
    await setupPageWithState(driver, acc_name);
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

    await poolDetails.setFirstTokenAmount("10");
    await poolDetails.waitSecondTokenAmountSet(true);
    const secondTokenAmount = await poolDetails.getSecondTokenAmount();
    expect(secondTokenAmount).toBeGreaterThan(0);
    await poolDetails.waitAddLiqBtnVisible();
    await poolDetails.clickSubmitLiquidity();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.AddLiquidity,
      2,
    );
  });

  it("Remove pool liquidity", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, 100);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    const isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeTruthy();
    await positionPageDriver.clickPromPoolPosition(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    await positionPageDriver.setupRemovableLiquidity();
    await positionPageDriver.clickRemoveLiquidity();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.RemoveLiquidity,
      2,
    );
  });

  it("Activate and deactivate liquidity", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 8, 18, 100);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    const isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      TUR_ASSET_NAME,
      MGX_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeTruthy();

    await positionPageDriver.clickPromPoolPosition(
      TUR_ASSET_NAME,
      MGX_ASSET_NAME,
    );
    await positionPageDriver.chooseLiqMiningPage();

    let isClaimableRewardsVisible =
      await positionPageDriver.isClaimableRewardsDisplayed();
    expect(isClaimableRewardsVisible).toBeTruthy();
    let isLpTokensValuesVisible =
      await positionPageDriver.isLpTokensValuesDisplayed();
    expect(isLpTokensValuesVisible).toBeTruthy();
    await positionPageDriver.expandPoolPositonCard();
    await positionPageDriver.activateAllLiq();
    await positionPageDriver.waitCalculatingFee();
    await positionPageDriver.clickConfirmFeeAmount();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.ActivateLiquidity,
      2,
    );

    await positionPageDriver.clickPromPoolPosition(
      TUR_ASSET_NAME,
      MGX_ASSET_NAME,
    );
    await positionPageDriver.chooseLiqMiningPage();

    await positionPageDriver.expandPoolPositonCard();
    isClaimableRewardsVisible =
      await positionPageDriver.isClaimableRewardsDisplayed();
    expect(isClaimableRewardsVisible).toBeTruthy();
    isLpTokensValuesVisible =
      await positionPageDriver.isLpTokensValuesDisplayed();
    expect(isLpTokensValuesVisible).toBeTruthy();

    await positionPageDriver.deactivateAllLiq();
    await positionPageDriver.waitCalculatingFee();
    await positionPageDriver.clickConfirmFeeAmount();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.DeactivateLiquidity,
      2,
    );
  });

  it("User can see liquidity providing details (share of pool) - promoted pool", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 8, 18, 100);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    const isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      TUR_ASSET_NAME,
      MGX_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeTruthy();
    await positionPageDriver.clickPromPoolPosition(
      TUR_ASSET_NAME,
      MGX_ASSET_NAME,
    );
    await positionPageDriver.chooseLiqMiningPage();

    await positionPageDriver.expandPoolPositonCard();
    await positionPageDriver.activateAllLiq();
    await positionPageDriver.waitCalculatingFee();
    await positionPageDriver.clickConfirmFeeAmount();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.ActivateLiquidity,
      2,
    );

    await sidebar.clickNavPositions();
    const mgxKsmPositionValue = await positionPageDriver.checkPromPoolPosition(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(mgxKsmPositionValue).toBeGreaterThan(0);
  });

  it("User can see liquidity providing details (share of pool) - non-promoted pool", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 9, 12, 1);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    const isPoolTurKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      TUR_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(isPoolTurKsmVisible).toBeTruthy();
    const turKsmPositionValue =
      await positionPageDriver.checkNonPromPoolPosition(
        TUR_ASSET_NAME,
        KSM_ASSET_NAME,
      );
    expect(turKsmPositionValue).toBeGreaterThan(0);
  });

  it("User see hint if some positions are not active", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, 100);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    const isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeTruthy();
    const isRewardHintVisible =
      await positionPageDriver.isRewardHintDisplayed();
    expect(isRewardHintVisible).toBeTruthy();
  });

  it("User can see number of active rewards for his positions", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, 1000);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    const isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeTruthy();
    const isActiveRewardsVisible =
      await positionPageDriver.isActiveRewardsDisplayed();
    expect(isActiveRewardsVisible).toBeTruthy();
  });

  it("User can see position detail overview with token shares", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, 1000);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    const isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeTruthy();
    await positionPageDriver.clickPromPoolPosition(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    const tokensValues = await positionPageDriver.getPoolPositionTokensValues();
    expect(tokensValues.liquidityTokenValue).toBeGreaterThan(0);
    expect(tokensValues.firstTokenValue).toBeGreaterThan(0);
    expect(tokensValues.secondTokenValue).toBeGreaterThan(0);
  });

  it("User can search through his positions", async () => {
    let isPoolMgxKsmVisible: boolean;
    let isPoolTurKsmVisible: boolean;

    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, 1000);
    await addLiqTokenMicroapps(userAddress, mangata, 9, 12, 10);

    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavPositions();

    await positionPageDriver.waitForPoolPositionsVisible();
    await positionPageDriver.searchPoolToken(TUR_ASSET_NAME);
    isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    isPoolTurKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      TUR_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeFalsy();
    expect(isPoolTurKsmVisible).toBeTruthy();
    await positionPageDriver.closeSearchingBar();
    await positionPageDriver.searchPoolToken(MGX_ASSET_NAME);
    isPoolMgxKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    isPoolTurKsmVisible = await positionPageDriver.isLiqPoolDisplayed(
      TUR_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(isPoolMgxKsmVisible).toBeTruthy();
    expect(isPoolTurKsmVisible).toBeFalsy();
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
