/*
 *
 * @group ui
 */
import {Keyring} from "mangata-sdk/node_modules/@polkadot/api";
import BN from "bn.js";
import {WebDriver} from "selenium-webdriver";
import {getApi, initApi} from "../../utils/api";
import {Mangata} from "../../utils/frontend/pages/Mangata";

import {
  NotificationModal,
  ModalType,
} from "../../utils/frontend/pages/NotificationModal";
import {Swap} from "../../utils/frontend/pages/Swap";
import {Pool} from "../../utils/frontend/pages/Pool";
import {Sidebar} from "../../utils/frontend/pages/Sidebar";
import {DriverBuilder} from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  addExtraLogs,
} from "../../utils/frontend/utils/Helper";
import {AssetWallet, User} from "../../utils/User";
import {
  createPoolIfMissing,
  getEnvironmentRequiredVars,
  waitForNBlocks,
} from "../../utils/utils";
import {FIVE_MIN, mETH_ASSET_NAME, MGA_ASSET_NAME} from "../../utils/Constants";
import {BrunLiquidityModal} from "../../utils/frontend/pages/BrunLiquidityModal";
import {Assets} from "../../utils/Assets";
import {Polkadot} from "../../utils/frontend/pages/Polkadot";

const MGA_ASSET_ID = new BN(0);
const ETH_ASSET_ID = new BN(1);

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can see the new Modal", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;
  const {sudo: sudoUserName} = getEnvironmentRequiredVars();
  const visibleValueNumber = Math.pow(10, 19).toString();

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({type: "sr25519"});

    driver = await DriverBuilder.getInstance();

    const {mnemonic} = await setupAllExtensions(driver);

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    sudo = new User(keyring, sudoUserName);
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(visibleValueNumber));
    await sudo.mint(
      ETH_ASSET_ID,
      testUser1,
      new BN((parseInt(visibleValueNumber) / 1000).toString())
    );
    await createPoolIfMissing(
      sudo,
      visibleValueNumber,
      MGA_ASSET_ID,
      ETH_ASSET_ID
    );
    testUser1.addAsset(MGA_ASSET_ID);
    testUser1.addAsset(ETH_ASSET_ID);
  });

  it("Modal contains currencies and amounts when Swapping", async () => {
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const swapView = new Swap(driver);
    await swapView.swapAssets(mETH_ASSET_NAME, MGA_ASSET_NAME, "0.001");
    const modal = new NotificationModal(driver);
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    const modalInfo = await modal.getModalInfo(ModalType.Confirm);
    expect(modalInfo.fromAmount).toEqual("0.001");
    expect(modalInfo.fromAsset).toEqual(mETH_ASSET_NAME);
    expect(modalInfo.toAsset).toEqual(MGA_ASSET_NAME);
  });

  it("Modal contains currencies and amounts when providing liquidity", async () => {
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(mETH_ASSET_NAME);
    await poolView.selectToken2Asset(MGA_ASSET_NAME);
    await poolView.addToken1AssetAmount("0.001");
    await poolView.provideOrCreatePool();

    const modal = new NotificationModal(driver);
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    const modalInfo = await modal.getModalInfo(ModalType.Confirm);
    expect(modalInfo.fromAmount).toEqual("0.001");
    expect(modalInfo.fromAsset).toEqual(mETH_ASSET_NAME);
    expect(modalInfo.toAsset).toEqual(MGA_ASSET_NAME);
  });

  it("Modal is visible when burning liquidity", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    let amountToMint = new BN(visibleValueNumber).div(new BN(2000));
    amountToMint = amountToMint.add(new BN("123456789123456"));
    await testUser1.mintLiquidity(ETH_ASSET_ID, MGA_ASSET_ID, amountToMint);
    const mga = new Mangata(driver);
    await mga.navigate();
    const sidebar = new Sidebar(driver);
    await sidebar.clickOnLiquidityPool(MGA_ASSET_NAME, mETH_ASSET_NAME);
    await sidebar.clickOnRemoveLiquidity();
    const burnModal = new BrunLiquidityModal(driver);
    await burnModal.confirm();
    const notificationModal = new NotificationModal(driver);
    await waitForNBlocks(3);
    const isModalWaitingForSignVisible = await notificationModal.isModalVisible(
      ModalType.Confirm
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
    await driver.quit();
    await DriverBuilder.destroy();
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
  });
});

describe("UI tests - A user gets notified when error", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;
  const {sudo: sudoUserName} = getEnvironmentRequiredVars();
  const visibleValueNumber = Math.pow(10, 19).toString();
  let newToken1: BN;
  let newToken2: BN;

  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({type: "sr25519"});

    driver = await DriverBuilder.getInstance();

    const {mnemonic} = await setupAllExtensions(driver);

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    sudo = new User(keyring, sudoUserName);
  });

  it("When tx front - fails, User gets notified", async () => {
    [newToken1, newToken2] = await Assets.setupUserWithCurrencies(
      testUser1,
      [new BN(visibleValueNumber), new BN(visibleValueNumber)],
      sudo
    );
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(Assets.getAssetName(newToken1.toString()));
    await poolView.selectToken2Asset(Assets.getAssetName(newToken2.toString()));
    await poolView.clickToToken1MaxBtn();
    await poolView.clickToToken2MaxBtn();
    await poolView.provideOrCreatePool();
    await Polkadot.signTransaction(driver);
    const modal = new NotificationModal(driver);
    await modal.waitForModal(ModalType.Error);
    const detailedInfo = await modal.getModalErrorInfo(ModalType.Error);
    expect(detailedInfo.header).toEqual("Supply Failed");
    expect(detailedInfo.txInfo).toContain("Inability to pay some fees");
  });
  it("When tx extrinsic - fails, User gets notified", async () => {
    [newToken1] = await Assets.setupUserWithCurrencies(
      testUser1,
      [new BN(visibleValueNumber), new BN(visibleValueNumber)],
      sudo
    );
    await testUser1.addMGATokens(sudo);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(MGA_ASSET_NAME);
    await poolView.selectToken2Asset(Assets.getAssetName(newToken1.toString()));
    await poolView.clickToToken1MaxBtn();
    await poolView.clickToToken2MaxBtn();
    await poolView.provideOrCreatePool();
    await Polkadot.signTransaction(driver);
    const modal = new NotificationModal(driver);
    await modal.waitForModal(ModalType.Error);
    const detailedInfo = await modal.getModalErrorInfo(ModalType.Error);
    expect(detailedInfo.header).toEqual("Supply Failed");
    expect(detailedInfo.txInfo).toContain(
      "Something went wrong. Please try again."
    );
  });
  it("When user cancel a TX, User gets notified", async () => {
    [newToken1] = await Assets.setupUserWithCurrencies(
      testUser1,
      [new BN(visibleValueNumber), new BN(visibleValueNumber)],
      sudo
    );
    await testUser1.addMGATokens(sudo);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(MGA_ASSET_NAME);
    await poolView.selectToken2Asset(Assets.getAssetName(newToken1.toString()));
    await poolView.clickToToken1MaxBtn();
    await poolView.clickToToken2MaxBtn();
    await poolView.provideOrCreatePool();
    await Polkadot.cancelOperation(driver);
    const modal = new NotificationModal(driver);
    await modal.waitForModal(ModalType.Rejected);
    const detailedInfo = await modal.getModalErrorInfo(ModalType.Error);
    expect(detailedInfo.header).toEqual("Supply Rejected");
    expect(detailedInfo.txInfo).toContain("Supplying");
  });
  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
    await driver.quit();
    await DriverBuilder.destroy();
  });
  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
  });
});
