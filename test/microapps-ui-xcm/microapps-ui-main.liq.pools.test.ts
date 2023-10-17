/*
 *
 * @group microappsXCM
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

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const KSM_ASSET_NAME = "KSM";
const MGX_ASSET_NAME = "MGX";

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
