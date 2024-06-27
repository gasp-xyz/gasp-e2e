/*
 *
 * @group microappsTokens
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
import { FIVE_MIN, KSM_ASSET_ID, GASP_ASSET_ID } from "../../utils/Constants";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import { connectVertical } from "@acala-network/chopsticks";
import { BN_TEN_THOUSAND, BN_THOUSAND } from "@mangata-finance/sdk";
import { AssetId } from "../../utils/ChainSpecs";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs } from "../../utils/setup";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import { Tokens } from "../../utils/frontend/microapps-pages/Tokens";
import { TokenDetails } from "../../utils/frontend/microapps-pages/TokenDetails";
import { Swap } from "../../utils/frontend/microapps-pages/Swap";
import { LiqPoolDetils } from "../../utils/frontend/microapps-pages/LiqPoolDetails";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const KSM_ASSET_NAME = "KSM";
const MGX_ASSET_NAME = "MGX";
const TUR_ASSET_NAME = "TUR";
const IMBU_ASSET_NAME = "IMBU";

describe.skip("Miocroapps UI tokens & token details tests", () => {
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
    testUser1.addAsset(GASP_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("User can enter MGX token details page and trade token", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavTokens();

    const tokensPage = new Tokens(driver);
    const isTokensPageDisplayed = await tokensPage.isDisplayed();
    expect(isTokensPageDisplayed).toBeTruthy();
    const isTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(MGX_ASSET_NAME);
    expect(isTokenRowDisplayed).toBeTruthy();

    await tokensPage.clickTokenRow(MGX_ASSET_NAME);

    const tokenDetailsPage = new TokenDetails(driver);
    const tokenDetailsPageDisplayed = await tokenDetailsPage.isDisplayed();
    expect(tokenDetailsPageDisplayed).toBeTruthy();

    const tokenDetailsPriceDisplayed =
      await tokenDetailsPage.isPriceDisplayed();
    expect(tokenDetailsPriceDisplayed).toBeTruthy();
    const tokenDetailsVolumeDisplayed =
      await tokenDetailsPage.isVolumeDisplayed();
    expect(tokenDetailsVolumeDisplayed).toBeTruthy();
    const tokenChartDisplayed = await tokenDetailsPage.isChartDisplayed();
    expect(tokenChartDisplayed).toBeTruthy();

    await tokenDetailsPage.clickTradeToken();

    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    const firstTokenName = await swap.fetchPayTokenName();
    expect(firstTokenName).toEqual(MGX_ASSET_NAME);
  });

  it("User can enter MGX token details page and related pool", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavTokens();

    const tokensPage = new Tokens(driver);
    const isTokensPageDisplayed = await tokensPage.isDisplayed();
    expect(isTokensPageDisplayed).toBeTruthy();
    const isTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(MGX_ASSET_NAME);
    expect(isTokenRowDisplayed).toBeTruthy();

    await tokensPage.clickTokenRow(MGX_ASSET_NAME);

    const tokenDetailsPage = new TokenDetails(driver);
    const tokenDetailsPageDisplayed = await tokenDetailsPage.isDisplayed();
    expect(tokenDetailsPageDisplayed).toBeTruthy();

    const isMgxKsmPoolVisible = await tokenDetailsPage.isPoolItemDisplayed(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isMgxKsmPoolVisible).toBeTruthy();
    await tokenDetailsPage.clickPoolItem(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );

    const poolDetails = new LiqPoolDetils(driver);
    const isPoolDetailsVisible = await poolDetails.isDisplayed(
      MGX_ASSET_NAME + " / " + KSM_ASSET_NAME,
    );
    expect(isPoolDetailsVisible).toBeTruthy();
  });

  it("User can see MGX token detail rows", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavTokens();

    const tokensPage = new Tokens(driver);
    const isTokensPageDisplayed = await tokensPage.isDisplayed();
    expect(isTokensPageDisplayed).toBeTruthy();

    const isTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(MGX_ASSET_NAME);
    expect(isTokenRowDisplayed).toBeTruthy();
    const areTokenRowStatsDisplayed =
      await tokensPage.areTokenRowStatsDisplayed(MGX_ASSET_NAME);
    expect(areTokenRowStatsDisplayed).toBeTruthy();
    const tokenPrice = await tokensPage.getTokenPrice(MGX_ASSET_NAME);
    expect(tokenPrice).toBeGreaterThan(0);
    const tokenVolume = await tokensPage.getTokenVolume(MGX_ASSET_NAME);
    expect(tokenVolume).toBeGreaterThan(0);
  });

  it("User can see TUR token detail rows", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavTokens();

    const tokensPage = new Tokens(driver);
    const isTokensPageDisplayed = await tokensPage.isDisplayed();
    expect(isTokensPageDisplayed).toBeTruthy();

    const isTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(TUR_ASSET_NAME);
    expect(isTokenRowDisplayed).toBeTruthy();
    const areTokenRowStatsDisplayed =
      await tokensPage.areTokenRowStatsDisplayed(TUR_ASSET_NAME);
    expect(areTokenRowStatsDisplayed).toBeTruthy();
    const tokenPrice = await tokensPage.getTokenPrice(TUR_ASSET_NAME);
    expect(tokenPrice).toBeGreaterThan(0);
    const tokenVolume = await tokensPage.getTokenVolume(TUR_ASSET_NAME);
    expect(tokenVolume).toBeGreaterThan(0);
  });

  it("User can filter detail rows to only owned tokens", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavTokens();

    const tokensPage = new Tokens(driver);
    const isTokensPageDisplayed = await tokensPage.isDisplayed();
    expect(isTokensPageDisplayed).toBeTruthy();

    let isImbuTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(IMBU_ASSET_NAME);
    expect(isImbuTokenRowDisplayed).toBeTruthy();
    let isKSMTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(KSM_ASSET_NAME);
    expect(isKSMTokenRowDisplayed).toBeTruthy();

    await tokensPage.clickMyTokens();

    isImbuTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(IMBU_ASSET_NAME);
    expect(isImbuTokenRowDisplayed).toBeFalsy();
    isKSMTokenRowDisplayed =
      await tokensPage.isTokenRowDisplayed(KSM_ASSET_NAME);
    expect(isKSMTokenRowDisplayed).toBeTruthy();
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
