/*
 *
 * @group uiSequential
 */
import { jest } from "@jest/globals";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  setupPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { GASP_ASSET_ID, MGR_ASSET_NAME } from "../../utils/Constants";
import {
  ModalType,
  NotificationModal,
} from "../../utils/frontend/pages/NotificationModal";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { waitNewBlock } from "../../utils/eventListeners";
import { createAssetIfMissing, createPoolIfMissing } from "../../utils/tx";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Node } from "../../utils/Framework/Node/Node";
import { connectPolkadotWallet } from "../../utils/frontend/utils/Handlers";
import { Pool } from "../../utils/frontend/pages/Pool";

import "dotenv/config";

jest.retryTimes(1);
jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let sudo: SudoUser;
let testUser1: User;
const testAssetName = "TST4";
let testAssetId: BN;

describe("UI tests - pools, provide liquidity", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    sudo = new SudoUser(keyring, node);
    keyring.addPair(sudo.keyRingPair);
    await setupApi();
    await setupUsers();
    driver = await DriverBuilder.getInstance();
    const { mnemonic } = await setupPolkadotExtension(driver);
    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    testAssetId = await createAssetIfMissing(sudo, testAssetName);
    await createPoolIfMissing(
      sudo,
      "1800000000000000000000000000000000",
      GASP_ASSET_ID,
      testAssetId,
    );

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(new BN(7), testUser1), // transferAll test
      Assets.mintToken(testAssetId, testUser1), // transferAll test
      Assets.mintNative(testUser1),
    );

    testUser1.addAsset(testAssetId);
    testUser1.addAsset(GASP_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("User can provide liquidity", async () => {
    getApi();

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await connectPolkadotWallet(driver, sidebar, mga);
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.toggleShowAllTokens();
    await poolView.selectToken1Asset(testAssetName);
    await poolView.selectToken2Asset(MGR_ASSET_NAME);
    await poolView.addToken1AssetAmount("1000");
    await poolView.provideOrCreatePool();
    const modal = new NotificationModal(driver);
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm,
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    const visible: boolean[] = [];
    for (let index = 0; index < 4; index++) {
      visible.push(await modal.isModalVisible(ModalType.Progress));
      await waitNewBlock();
    }
    expect(visible.some((visibleInBlock) => visibleInBlock)).toBeTruthy();
    await modal.waitForModalState(ModalType.Success);
    const isModalSuccessVisible = await modal.isModalVisible(ModalType.Success);
    expect(isModalSuccessVisible).toBeTruthy();
    await modal.clickInDone();

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const testAssetAmountBefore =
      testUser1.getAsset(testAssetId)?.amountBefore.free!;
    const testAssetAmountAfter =
      testUser1.getAsset(testAssetId)?.amountAfter.free!;
    const mgrAmountBefore =
      testUser1.getAsset(GASP_ASSET_ID)?.amountBefore.free!;
    const mgrAmountAfter = testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.free!;

    const liquidityProvided =
      testAssetAmountBefore.gt(testAssetAmountAfter) &&
      mgrAmountBefore.gt(mgrAmountAfter);
    expect(liquidityProvided).toBeTruthy();

    const poolVisible = await new Sidebar(driver).isLiquidityPoolVisible(
      MGR_ASSET_NAME,
      testAssetName,
    );
    expect(poolVisible).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    await driver.quit();
    DriverBuilder.destroy();
    const api = getApi();
    await api.disconnect();
  });
});
