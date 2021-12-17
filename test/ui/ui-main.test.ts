/*
 *
 * @group ui
 * @group ui-smoke
 */
import {Keyring} from "mangata-sdk/node_modules/@polkadot/api";
import BN from "bn.js";
import {WebDriver} from "selenium-webdriver";
import {getApi, initApi} from "../../utils/api";
import {waitNewBlock} from "../../utils/eventListeners";
import {Mangata} from "../../utils/frontend/pages/Mangata";
import {Polkadot} from "../../utils/frontend/pages/Polkadot";
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
  uiStringToBN,
} from "../../utils/frontend/utils/Helper";
import {AssetWallet, User} from "../../utils/User";
import {
  createPoolIfMissing,
  getEnvironmentRequiredVars,
} from "../../utils/utils";
import {FIVE_MIN, mETH_ASSET_NAME, MGA_ASSET_NAME} from "../../utils/Constants";
import {BrunLiquidityModal} from "../../utils/frontend/pages/BrunLiquidityModal";
import {Assets} from "../../utils/Assets";

const MGA_ASSET_ID = new BN(0);
const ETH_ASSET_ID = new BN(1);

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can swap and mint tokens", () => {
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

  it("As a User I can Swap tokens - MGA - mETH", async () => {
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(mETH_ASSET_NAME);
    await swapView.addPayAssetAmount("0.001");
    await swapView.doSwap();
    const modal = new NotificationModal(driver);
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    const visible: boolean[] = [];
    for (let index = 0; index < 4; index++) {
      visible.push(await modal.isModalVisible(ModalType.Progress));
      await waitNewBlock();
    }
    expect(
      visible.some((visibleInBlock) => visibleInBlock === true)
    ).toBeTruthy();
    const isModalSuccessVisible = await modal.isModalVisible(ModalType.Success);
    expect(isModalSuccessVisible).toBeTruthy();
    await modal.clickInDone();

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const swapped = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore.free!.lt(
        testUser1.getAsset(ETH_ASSET_ID)?.amountAfter.free!
      );
    const methValue = await swapView.getBalanceFromAssetGet();
    expect(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter.free!).bnEqual(
      uiStringToBN(methValue)
    );
    expect(swapped).toBeTruthy();
  });
  it("As a User I can mint some tokens MGA - mETH", async () => {
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(mETH_ASSET_NAME);
    await poolView.selectToken2Asset(MGA_ASSET_NAME);
    await poolView.addToken1AssetAmount("0.001");
    await poolView.provideOrCreatePool();

    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    for (let index = 0; index < 4; index++) {
      await waitNewBlock();
    }

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const swapped = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore.free!.gt(
        testUser1.getAsset(ETH_ASSET_ID)?.amountAfter.free!
      );
    const poolInvested = await new Sidebar(driver).isLiquidityPoolVisible(
      MGA_ASSET_NAME,
      mETH_ASSET_NAME
    );
    const mgaValue = await poolView.getBalanceFromtoken2();
    const userWalletValue = testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!;
    const mgaValueBn = uiStringToBN(mgaValue);
    expect(userWalletValue).bnEqual(mgaValueBn);
    expect(poolInvested).toBeTruthy();
    expect(swapped).toBeTruthy();
  });

  it("As a User I can burn all liquidity MGA - mETH", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    let amountToMint = new BN(visibleValueNumber).div(new BN(2000));
    amountToMint = amountToMint.add(new BN("123456789123456"));
    await testUser1.mintLiquidity(ETH_ASSET_ID, MGA_ASSET_ID, amountToMint);
    const mga = new Mangata(driver);
    await mga.navigate();
    const sidebar = new Sidebar(driver);
    await sidebar.clickOnLiquidityPool(MGA_ASSET_NAME, mETH_ASSET_NAME);
    await sidebar.clickOnRemoveLiquidity();
    const modal = new BrunLiquidityModal(driver);
    await modal.clickOn100Amount();
    await modal.confirmAndSign();
    for (let index = 0; index < 4; index++) {
      await waitNewBlock();
    }
    const isPoolVisible = await sidebar.isLiquidityPoolVisible(
      MGA_ASSET_NAME,
      mETH_ASSET_NAME
    );
    expect(isPoolVisible).toBeFalsy();

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    expect(
      testUser1.getAsset(ETH_ASSET_ID)?.amountBefore.free!.sub(new BN(1))
    ).bnEqual(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter.free!);
  });

  it("As a User I can mint in more than one pool [ MGA - mETH ] [ MGA - newTokn ] and get invested values", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const newToken = await Assets.issueAssetToUser(
      testUser1,
      new BN(visibleValueNumber),
      sudo
    );
    const amountToMint = new BN(visibleValueNumber).div(new BN(2000));
    await testUser1.mintLiquidity(ETH_ASSET_ID, MGA_ASSET_ID, amountToMint);
    await testUser1.createPoolToAsset(
      amountToMint,
      amountToMint,
      newToken,
      MGA_ASSET_ID
    );

    const mga = new Mangata(driver);
    await mga.navigate();
    const sidebar = new Sidebar(driver);
    let isPoolVisible = await sidebar.isLiquidityPoolVisible(
      MGA_ASSET_NAME,
      mETH_ASSET_NAME
    );
    expect(isPoolVisible).toBeTruthy();
    const assetName = Assets.getAssetName(newToken.toString());
    isPoolVisible = await sidebar.isLiquidityPoolVisible(
      assetName,
      MGA_ASSET_NAME
    );
    expect(isPoolVisible).toBeTruthy();

    await sidebar.clickOnLiquidityPool(assetName, MGA_ASSET_NAME);
    const investedNewToken = await sidebar.getAssetValueInvested(assetName);
    const investedMGA = await sidebar.getAssetValueInvested(MGA_ASSET_NAME);
    //assetTokenhas18 decimals,
    const displayedAmount =
      parseFloat(amountToMint.toString()) / Math.pow(10, 18);

    expect(investedNewToken.includes(displayedAmount.toString())).toBeTruthy();
    expect(investedMGA.includes(displayedAmount.toString())).toBeTruthy();
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
