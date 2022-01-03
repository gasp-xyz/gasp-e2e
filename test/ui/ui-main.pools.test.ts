/*
 *
 * @group ui
 */
import {Keyring} from "@polkadot/api";
import BN from "bn.js";
import {WebDriver} from "selenium-webdriver";
import {getApi, initApi} from "../../utils/api";
import {Mangata} from "../../utils/frontend/pages/Mangata";
import {Polkadot} from "../../utils/frontend/pages/Polkadot";
import {Pool} from "../../utils/frontend/pages/Pool";
import {Sidebar} from "../../utils/frontend/pages/Sidebar";
import {DriverBuilder} from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  addExtraLogs,
} from "../../utils/frontend/utils/Helper";
import {AssetWallet, User} from "../../utils/User";
import {getEnvironmentRequiredVars, waitForNBlocks} from "../../utils/utils";
import {FIVE_MIN, MGA_ASSET_NAME} from "../../utils/Constants";
import {Assets} from "../../utils/Assets";
import {NotificationModal} from "../../utils/frontend/pages/NotificationModal";

const MGA_ASSET_ID = new BN(0);
let createdAssetID: BN;
let assetName = "";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can create a pool MGA - newToken", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;
  const {sudo: sudoUserName} = getEnvironmentRequiredVars();
  const visibleValueNumber = Math.pow(10, 19).toString();

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({type: "sr25519"});
  });

  beforeAll(async () => {
    driver = await DriverBuilder.getInstance();

    const {mnemonic} = await setupAllExtensions(driver);

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);
    sudo = new User(keyring, sudoUserName);
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(visibleValueNumber));
    const assetIds = await Assets.setupUserWithCurrencies(
      testUser1,
      [new BN(visibleValueNumber)],
      sudo
    );
    testUser1.addAsset(MGA_ASSET_ID);
    testUser1.addAsset(assetIds[0]);
    assetName = `m${assetIds[0]}`;
    createdAssetID = assetIds[0];
  });

  it("As a User I can create a pool", async () => {
    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(assetName);
    await poolView.selectToken2Asset(MGA_ASSET_NAME);
    await poolView.addToken1AssetAmount("1.234");
    await poolView.addToken2AssetAmount("1.234");
    await poolView.provideOrCreatePool();

    await Polkadot.signTransaction(driver);

    await waitForNBlocks(5);
    const modal = new NotificationModal(driver);
    await modal.clickInDone();
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const mgaReduced = testUser1
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.free!.gt(
        testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!
      );

    const assetReduced = testUser1
      .getAsset(createdAssetID)
      ?.amountBefore.free!.gt(
        testUser1.getAsset(createdAssetID)?.amountAfter.free!
      );

    const poolInvested = await new Sidebar(driver).isLiquidityPoolVisible(
      assetName,
      MGA_ASSET_NAME
    );
    expect(poolInvested).toBeTruthy();
    expect(assetReduced).toBeTruthy();
    expect(mgaReduced).toBeTruthy();
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
    await DriverBuilder.destroy();
    const api = getApi();
    await api.disconnect();
  });
});
