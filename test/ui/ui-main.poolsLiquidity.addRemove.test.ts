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
import { MGA_ASSET_ID, MGR_ASSET_NAME } from "../../utils/Constants";
import { ExtrinsicResult, waitNewBlock } from "../../utils/eventListeners";
import {
  createAssetIfMissing,
  createPoolIfMissing,
  mintLiquidity,
} from "../../utils/tx";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Node } from "../../utils/Framework/Node/Node";
import { connectPolkadotWallet } from "../../utils/frontend/utils/Handlers";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Pool } from "../../utils/frontend/pages/Pool";
import { BurnLiquidityModal } from "../../utils/frontend/pages/BurnLiquidityModal";
import {
  ModalType,
  NotificationModal,
} from "../../utils/frontend/pages/NotificationModal";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let sudo: SudoUser;
let testUser1: User;
const testAssetName = "TST4";
let testAssetId: BN;

describe("UI tests - adding, removing liquidity", () => {
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
      MGA_ASSET_ID,
      testAssetId,
    );

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(testAssetId, testUser1),
      Assets.mintNative(testUser1),
    );

    const assetAmount = new BN("1000000000000000");

    await mintLiquidity(
      testUser1.keyRingPair,
      testAssetId,
      MGA_ASSET_ID,
      assetAmount,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityMinted",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    testUser1.addAsset(testAssetId);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  test("User can add liquidity", async () => {
    getApi();

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await connectPolkadotWallet(driver, sidebar, mga);
    await sidebar.waitForLoad();
    await sidebar.waitForWalletConnected();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();
    await sidebar.waitForLiquidityPoolToLoad(MGR_ASSET_NAME, testAssetName);

    const poolVisible = await sidebar.isLiquidityPoolVisible(
      MGR_ASSET_NAME,
      testAssetName,
    );
    expect(poolVisible).toBeTruthy();

    await sidebar.clickLiquidityPool(MGR_ASSET_NAME, testAssetName);
    const isPoolDetailVisible = await sidebar.isPoolDetailVisible();
    expect(isPoolDetailVisible).toBeTruthy();

    await sidebar.clickOnAddLiquidity();

    const poolView = new Pool(driver);
    const poolToggled = await poolView.isPoolToggled();
    expect(poolToggled).toBeTruthy();

    const firstTokenText = await poolView.getToken1Text();
    expect(firstTokenText).toEqual(MGR_ASSET_NAME);
    const secondTokenText = await poolView.getToken2Text();
    expect(secondTokenText).toEqual(testAssetName);
  });

  test("User can remove liquidity", async () => {
    getApi();

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    await sidebar.waitForLoad();
    await sidebar.waitForWalletConnected();
    const isWalletConnected = await sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    await sidebar.waitForLiquidityPoolToLoad(MGR_ASSET_NAME, testAssetName);
    let poolVisible = await sidebar.isLiquidityPoolVisible(
      MGR_ASSET_NAME,
      testAssetName,
    );
    expect(poolVisible).toBeTruthy();

    await sidebar.clickLiquidityPool(MGR_ASSET_NAME, testAssetName);
    const isPoolDetailVisible = await sidebar.isPoolDetailVisible();
    expect(isPoolDetailVisible).toBeTruthy();

    await sidebar.clickOnRemoveLiquidity();

    const burnLiquidityModal = new BurnLiquidityModal(driver);
    const isModalVisible = await burnLiquidityModal.isModalVisible();
    expect(isModalVisible).toBeTruthy();

    await burnLiquidityModal.clickOn100Amount();
    await burnLiquidityModal.confirm();

    const modal = new NotificationModal(driver);
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm,
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    await Polkadot.signTransaction(driver);

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

    const liquidityProvided = testAssetAmountBefore.lt(testAssetAmountAfter);
    expect(liquidityProvided).toBeTruthy();

    poolVisible = await sidebar.isLiquidityPoolVisible(
      MGR_ASSET_NAME,
      testAssetName,
    );
    expect(poolVisible).toBeFalsy();
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
