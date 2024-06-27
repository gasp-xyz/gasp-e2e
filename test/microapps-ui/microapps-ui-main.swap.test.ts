/*
 *
 * @group skipped
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
import {
  FIVE_MIN,
  KSM_ASSET_ID,
  GASP_ASSET_ID,
  MGR_ASSET_NAME,
} from "../../utils/Constants";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars, sleep } from "../../utils/utils";
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

describe("Miocroapps UI swap tests", () => {
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
    testUser1.addAsset(GASP_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("Swap is enabled with enough tokens", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
    await swap.setPayTokenAmount("1000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    await swap.waitForSwapButtonEnabled();
    const isSwapEnabled = await swap.isSwapButtonEnabled();
    expect(isSwapEnabled).toBeTruthy();
  });

  it("Swap is disabled with not enough tokens", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken("ROC");
    await swap.pickGetToken(MGR_ASSET_NAME);
    await swap.setPayTokenAmount("1000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    const isSwapEnabled = await swap.isSwapButtonEnabled();
    expect(isSwapEnabled).toBeFalsy();
  });

  it("Swap details are visible & dynamic", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
    await swap.setPayTokenAmount("100");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    const isTradeRateDisplayed = await swap.isTradeRateDisplayed();
    expect(isTradeRateDisplayed).toBeTruthy();

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    await swap.toggleRouteDetails();
    const areRouteDetailsDisplayed = await swap.areRouteDetailsDisplayed(
      MGR_ASSET_NAME,
      "ROC",
    );
    expect(areRouteDetailsDisplayed).toBeTruthy();

    const minimumRecieved = await swap.fetchMinimumReceivedAmount();
    await swap.setPayTokenAmount("200");
    const minimumRecievedAfterChange = await swap.fetchMinimumReceivedAmount();
    expect(minimumRecieved).toBeLessThan(minimumRecievedAfterChange);
  });

  it("Swap fee lock - less than 10k MGX", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
    await swap.setPayTokenAmount("100");

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    const swapFee = await swap.fetchSwapFee();
    expect(swapFee).toEqual(50);

    const isSwapFeeAlert = await swap.isSwapFeeAlert();
    expect(isSwapFeeAlert).toBeFalsy();
  });

  it("Swap free - more than 10k MGX", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
    await swap.setPayTokenAmount("10001");

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    const swapFee = await swap.fetchSwapFee();
    expect(swapFee).toEqual(0);

    const isSwapFeeAlert = await swap.isSwapFeeAlert();
    expect(isSwapFeeAlert).toBeFalsy();
  });

  it("Swap alert - not enough MGX to do transaction", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
    await swap.setPayTokenAmount("100000");

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    const swapFee = await swap.fetchSwapFee();
    expect(swapFee).toEqual(0);

    const isSwapFeeAlert = await swap.isSwapFeeAlert();
    expect(isSwapFeeAlert).toBeFalsy();
  });

  it("Swap alert - not enough MGX to lock", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
    await swap.setPayTokenAmount("9995");

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    const swapFee = await swap.fetchSwapFee();
    expect(swapFee).toEqual(50);

    const isSwapFeeAlert = await swap.isSwapFeeAlert();
    expect(isSwapFeeAlert).toBeTruthy();
  });

  it("Switch transaction tokens and values", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
    await swap.setPayTokenAmount("1000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    await swap.switchTokens();
    await sleep(1000);

    const payTokenNameAfterSwitch = await swap.fetchPayTokenName();
    expect(payTokenNameAfterSwitch).toEqual("ROC");
    const getTokenNameAfterSwitch = await swap.fetchGetTokenName();
    expect(getTokenNameAfterSwitch).toEqual(MGR_ASSET_NAME);
    const payTokeAmountAfterSwitch = await swap.fetchPayAssetAmount();
    expect(payTokeAmountAfterSwitch).toEqual(getTokenAmount);
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
