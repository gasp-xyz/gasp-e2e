/*
 *
 * @group microappsProdWallet
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
import { KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const MGX_ASSET_NAME = "MGX";
const TUR_ASSET_NAME = "TUR";

describe("Microapps Prod UI wallet tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

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

  test("User can see his tokens and amounts", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const isMGX = await walletWrapper.isMyTokensRowDisplayed(MGX_ASSET_NAME);
    expect(isMGX).toBeTruthy();
    const isTUR = await walletWrapper.isMyTokensRowDisplayed(TUR_ASSET_NAME);
    expect(isTUR).toBeTruthy();

    const mgxAmount = await walletWrapper.getMyTokensRowAmount(MGX_ASSET_NAME);
    expect(parseFloat(mgxAmount)).toBeGreaterThan(0);

    const turAmount = await walletWrapper.getMyTokensRowAmount(TUR_ASSET_NAME);
    expect(parseFloat(turAmount)).toBeGreaterThan(0);
  });

  test("User can see his pool positions", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.pickMyPositions();
    const POOL_NAME = "TUR - MGX";
    const isTurMgx = await walletWrapper.isMyPositionsRowDisplayed(POOL_NAME);
    expect(isTurMgx).toBeTruthy();
  });

  test("User can see his tokens fiat value", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const isMGX = await walletWrapper.isMyTokensRowDisplayed(MGX_ASSET_NAME);
    expect(isMGX).toBeTruthy();
    const isTUR = await walletWrapper.isMyTokensRowDisplayed(TUR_ASSET_NAME);
    expect(isTUR).toBeTruthy();

    const mgxValue =
      await walletWrapper.getMyTokensRowFiatValue(MGX_ASSET_NAME);
    expect(parseFloat(mgxValue)).toBeGreaterThan(0);

    const turValue =
      await walletWrapper.getMyTokensRowFiatValue(TUR_ASSET_NAME);
    expect(parseFloat(turValue)).toBeGreaterThan(0);
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
});
