/*
 *
 * @group ui
 */
import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { waitNewBlock } from "../../utils/eventListeners";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { Swap } from "../../utils/frontend/pages/Swap";
import { Pool } from "../../utils/frontend/pages/Pool";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  addExtraLogs,
} from "../../utils/frontend/utils/Helper";
import { getBalanceOfPool } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  FIVE_MIN,
  mETH_ASSET_NAME,
  MGA_ASSET_NAME,
} from "../../utils/Constants";
import { BrunLiquidityModal } from "../../utils/frontend/pages/BrunLiquidityModal";
import { Assets } from "../../utils/Assets";

const MGA_ASSET_ID = new BN(0);
const ETH_ASSET_ID = new BN(1);

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can swap and mint tokens", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  const visibleValueNumber = Math.pow(10, 19).toString();

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });

    driver = await DriverBuilder.getInstance();

    const { mnemonic } = await setupAllExtensions(driver);

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    sudo = new User(keyring, sudoUserName);
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(visibleValueNumber));
    const balance = await getBalanceOfPool(MGA_ASSET_ID, ETH_ASSET_ID);
    await sudo.mint(
      ETH_ASSET_ID,
      testUser1,
      new BN((parseInt(visibleValueNumber) / 1000).toString())
    );
    if (balance[0]!.isZero() || balance[1].isZero()) {
      await sudo.mint(MGA_ASSET_ID, sudo, new BN(visibleValueNumber));
      await sudo.mint(ETH_ASSET_ID, sudo, new BN(visibleValueNumber));
      const poolValue = new BN(visibleValueNumber).div(new BN(2));
      await sudo.createPoolToAsset(
        poolValue,
        poolValue,
        MGA_ASSET_ID,
        ETH_ASSET_ID
      );
    }
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

    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    for (let index = 0; index < 4; index++) {
      await waitNewBlock(true);
    }

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const swapped = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore!.lt(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!);

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
    await poolView.provideToPool();

    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    for (let index = 0; index < 4; index++) {
      await waitNewBlock(true);
    }

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const swapped = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore!.gt(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!);
    const poolInvested = await new Sidebar(driver).isLiquidityPoolVisible(
      MGA_ASSET_NAME,
      mETH_ASSET_NAME
    );
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
    await modal.setAmount("100");
    await modal.confirmAndSign();
    for (let index = 0; index < 4; index++) {
      await waitNewBlock(true);
    }
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const isPoolVisible = await sidebar.isLiquidityPoolVisible(
      MGA_ASSET_NAME,
      mETH_ASSET_NAME
    );
    expect(isPoolVisible).toBeFalsy();
    // removing 1 token because of rounding either when minting, either when burning.
    // Checked with Stano.
    expect(
      testUser1.getAsset(ETH_ASSET_ID)?.amountBefore!.sub(new BN(1))
    ).bnEqual(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!);
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
  });

  afterAll(async () => {
    await driver.quit();
    const api = getApi();
    await api.disconnect();
  });
});
