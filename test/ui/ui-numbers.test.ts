/*
 *
 * @group ui
 */
import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Swap } from "../../utils/frontend/pages/Swap";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  addExtraLogs,
  uiStringToBN,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { FIVE_MIN, MAX_BALANCE, MGA_ASSET_NAME } from "../../utils/Constants";
import { Assets } from "../../utils/Assets";

const MGA_ASSET_ID = new BN(0);

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can use small and big numbers:", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;
  let maxValueToken: BN, minValueToken: BN;
  let assetNameMax: string, assetNameMin: string;
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
    testUser1.addAsset(MGA_ASSET_ID);
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(visibleValueNumber));
    [maxValueToken, minValueToken] = await Assets.setupUserWithCurrencies(
      testUser1,
      [MAX_BALANCE, new BN(100)],
      sudo
    );
    assetNameMax = Assets.getAssetName(maxValueToken.toString());
    assetNameMin = Assets.getAssetName(minValueToken.toString());
  });

  it("As a User I can see the max possible value in UI", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(assetNameMax);
    const sidebar = new Sidebar(driver);

    const visibleAssetValue = await sidebar.getAssetValue(assetNameMax);
    const copiedAssetValue = await sidebar.copyAssetValue(assetNameMax);
    const balanceAvailableInSwap = await swapView.getBalanceFromAssetGet();

    // format and expect
    const split18decimals = testUser1
      .getAsset(maxValueToken)
      ?.amountBefore!.free!.toString()
      .match(/^(.*)(.{18})/)!
      .slice(1)
      .join(".");

    expect(split18decimals).toEqual(copiedAssetValue);
    expect(split18decimals).toEqual(balanceAvailableInSwap);
    expect(copiedAssetValue.includes(visibleAssetValue)).toBeTruthy();
  });
  it("As a User I can see the min value in UI", async () => {
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    //do
    const mga = new Mangata(driver);
    await mga.navigate();
    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(assetNameMin);
    const sidebar = new Sidebar(driver);

    const visibleAssetValue = await sidebar.getAssetValue(assetNameMin);
    const copiedAssetValue = await sidebar.copyAssetValue(assetNameMin);
    const balanceAvailableInSwap = await swapView.getBalanceFromAssetGet();

    // format and expect
    const assetFromNode =
      testUser1.getAsset(minValueToken)?.amountBefore!.free!;

    expect(assetFromNode).bnEqual(uiStringToBN(copiedAssetValue));
    expect(assetFromNode).bnEqual(uiStringToBN(balanceAvailableInSwap));
    expect(visibleAssetValue).toEqual("<0.001");
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
