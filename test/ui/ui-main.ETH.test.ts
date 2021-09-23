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
    await sidebar.depositAseetsFromMetamask("kETH", "0.001");
    await sidebar.waitForTokenToAppear("mETH");
    const tokenValue = await sidebar.getTokenAmount("mETH");
    expect(tokenValue).toEqual("0.001");
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const amount = new BN(Math.pow(10, 15).toString());
    const addFromWallet = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore!.add(amount);
    expect(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!).bnEqual(
      addFromWallet!
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
    await DriverBuilder.destroy();
  });
});

describe("UI main tests - Withdraw - ETH", () => {
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

    const mga = new Mangata(driver);
    await mga.navigate();
    const sidebar = new Sidebar(driver);
    const ableToContinueM = await sidebar.isMetamaskExtensionOK();
    const ableToContinueP = await sidebar.isPolkadotExtensionOK();
    expect(ableToContinueM).toBeTruthy();
    expect(ableToContinueP).toBeTruthy();
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(10000000000));

    //TODO replace this with Eddy code to give to a user some assetInfo.
    await sidebar.depositAseetsFromMetamask("kETH", "0.001");
    await sidebar.waitForTokenToAppear("mETH");
    const tokenValue = await sidebar.getTokenAmount("mETH");
    expect(tokenValue).toEqual("0.001");
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
  });

  it("As a User I can Withdraw ETH from Meta extension", async () => {
    const sidebar = new Sidebar(driver);
    await sidebar.withdrawAllAssetsToMetaMask("mETH");
    await sidebar.waitForTokenToDissapear("mETH");
    await testUser1.refreshAmounts(AssetWallet.AFTER);

    const amount = new BN(Math.pow(10, 15).toString());
    const diffFromWallet = testUser1
      .getAsset(ETH_ASSET_ID)
      ?.amountBefore!.sub(amount);
    expect(testUser1.getAsset(ETH_ASSET_ID)?.amountAfter!).bnEqual(
      diffFromWallet!
    );
    // TODO, validate in eth that user now has the tokens back!
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
});

afterAll(async () => {
  const api = getApi();
  await api.disconnect();
});
