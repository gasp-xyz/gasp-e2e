/*
 *
 * @group microappsSwap
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
import { KeyringPair } from "@polkadot/keyring/types";
import { FIVE_MIN } from "../../utils/Constants";
import { getEnvironmentRequiredVars, sleep } from "../../utils/utils";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForMicroappsActionNotification,
} from "../../utils/frontend/microapps-utils/Handlers";
import { Swap } from "../../utils/frontend/microapps-pages/Swap";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import { connectVertical } from "@acala-network/chopsticks";
import { BN_TEN_THOUSAND, BN_THOUSAND } from "@mangata-finance/sdk";
import { AssetId } from "../../utils/ChainSpecs";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs } from "../../utils/setup";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationToast";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const KSM_ASSET_NAME = "KSM";
const KSM_FULL_NAME = "Kusama Native";
const MGX_ASSET_NAME = "MGX";

describe("Miocroapps UI swap tests", () => {
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

    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("Swap is enabled with enough tokens", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
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
    await swap.pickPayToken(KSM_FULL_NAME);
    await swap.pickGetToken(MGX_ASSET_NAME);
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
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
    await swap.setPayTokenAmount("1000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    const isTradeRateDisplayed = await swap.isTradeRateDisplayed();
    expect(isTradeRateDisplayed).toBeTruthy();

    const areTradeDetailsDisplayed = await swap.areTradeDetailsDisplayed();
    expect(areTradeDetailsDisplayed).toBeTruthy();

    await swap.toggleRouteDetails();
    const areRouteDetailsDisplayed = await swap.areRouteDetailsDisplayed(
      MGX_ASSET_NAME,
      KSM_ASSET_NAME,
    );
    expect(areRouteDetailsDisplayed).toBeTruthy();

    const minimumRecieved = await swap.fetchMinimumReceivedAmount();
    await swap.setPayTokenAmount("2000");
    const minimumRecievedAfterChange = await swap.fetchMinimumReceivedAmount();
    expect(minimumRecieved).toBeLessThan(minimumRecievedAfterChange);
  });

  it("Swap fee lock - less than 10k MGX", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
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
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
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
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
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
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
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
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
    await swap.setPayTokenAmount("1000");
    const getTokenAmount = await swap.fetchGetAssetAmount();
    expect(parseFloat(getTokenAmount)).toBeGreaterThan(0);

    await swap.switchTokens();
    await sleep(1000);

    const payTokenNameAfterSwitch = await swap.fetchPayTokenName();
    expect(payTokenNameAfterSwitch).toEqual(KSM_ASSET_NAME);
    const getTokenNameAfterSwitch = await swap.fetchGetTokenName();
    expect(getTokenNameAfterSwitch).toEqual(MGX_ASSET_NAME);
    const payTokeAmountAfterSwitch = await swap.fetchPayAssetAmount();
    expect(payTokeAmountAfterSwitch).toEqual(getTokenAmount);
  });

  it("Swap is possible with enough tokens", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGX_ASSET_NAME);
    await swap.pickGetToken(KSM_FULL_NAME);
    await swap.setPayTokenAmount("500");
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
