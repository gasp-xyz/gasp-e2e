/*
 *
 * @group ui
 * @group ci
 */
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { ETH_ASSET_ID, FIVE_MIN, MGA_ASSET_ID } from "../../utils/Constants";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DepositModal } from "../../utils/frontend/pages/DepositModal";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  setupAllExtensions,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import BN from "bn.js";
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI main tests - Deposit - ETH", () => {
  let testUser1: User;
  let keyring: Keyring;
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
  });

  beforeEach(async () => {
    driver = await DriverBuilder.getInstance();
    const sudo = new User(keyring, sudoUserName);
    const { polkUserAddress } = await setupAllExtensions(driver);
    testUser1 = new User(keyring, undefined);
    testUser1.addFromAddress(keyring, polkUserAddress);
    testUser1.addAsset(MGA_ASSET_ID);
    testUser1.addAsset(ETH_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    const mga = new Mangata(driver);
    await mga.navigate();
    const sidebar = new Sidebar(driver);
    const ableToContinueM = await sidebar.isMetamaskExtensionOK();
    const ableToContinueP = await sidebar.isPolkadotExtensionOK();
    expect(ableToContinueM).toBeTruthy();
    expect(ableToContinueP).toBeTruthy();
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(10000000000));
  });

  it("As a User I can deposit ETH from Meta extension", async () => {
    const sidebar = new Sidebar(driver);
    await sidebar.clickOnDepositToMangata();
    const modal = new DepositModal(driver);
    await modal.selectToken("kETH");
    await modal.enterValue("0.001");
    await modal.clickContinue();
    await modal.confirmAndSign();
    await sidebar.waitForTokenToAppear("mETH");
    const tokenValue = await sidebar.getTokenAmount("mETH");
    expect(tokenValue).toEqual("0.001");
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    await testUser1.validateWalletIncreased(
      ETH_ASSET_ID,
      new BN(Math.pow(10, 15).toString())
    );
  });

  afterEach(async () => {
    const sidebar = new Sidebar(driver);
    // fire & forget the withdrawal. Its not in the scope of this test.
    await sidebar.withdrawAllAssetsToMetaMask("mETH");
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
    await driver.quit();
    const api = getApi();
    await api.disconnect();
  });
});
