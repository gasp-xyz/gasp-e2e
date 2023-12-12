/*
 *
 * @group microappsProdSwap
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
import { FIVE_MIN, KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { Swap } from "../../utils/frontend/microapps-pages/Swap";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;
const acc_name = "acc_automation";
const MGX_ASSET_NAME = "MGX";
const TUR_ASSET_NAME = "TUR";

describe("Miocroapps Prod UI swap tests", () => {
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

  it("Swap is enabled with enough tokens", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(TUR_ASSET_NAME);
    await swap.setPayTokenAmount("1");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    await swap.waitForSwapButtonEnabled();
    const isSwapEnabled = await swap.isSwapButtonEnabled();
    expect(isSwapEnabled).toBeTruthy();
  });

  it("Swap details are visible & dynamic", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(TUR_ASSET_NAME);
    await swap.setPayTokenAmount("10");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    const isTradeRateDisplayed = await swap.isTradeRateDisplayed();
    expect(isTradeRateDisplayed).toBeTruthy();

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    await swap.toggleRouteDetails();
    const areRouteDetailsDisplayed = await swap.areRouteDetailsDisplayed(
      MGX_ASSET_NAME,
      TUR_ASSET_NAME,
    );
    expect(areRouteDetailsDisplayed).toBeTruthy();

    const minimumRecieved = await swap.fetchMinimumReceivedAmount();
    await swap.setPayTokenAmount("50");
    const minimumRecievedAfterChange = await swap.fetchMinimumReceivedAmount();
    expect(minimumRecieved).toBeLessThan(minimumRecievedAfterChange);
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
