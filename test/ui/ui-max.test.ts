/*
 *
 * @group ui
 */
import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import {
  NotificationModal,
  ModalType,
} from "../../utils/frontend/pages/NotificationModal";
import { Swap } from "../../utils/frontend/pages/Swap";
import { Pool } from "../../utils/frontend/pages/Pool";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  addExtraLogs,
  uiStringToBN,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { FIVE_MIN, MGA_ASSET_NAME } from "../../utils/Constants";
import { Assets } from "../../utils/Assets";

const MGA_ASSET_ID = new BN(0);

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can use MAX:", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;
  let newToken: BN;
  let assetName: string;
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  const visibleValueNumber = Math.pow(10, 19).toString();

  beforeEach(async () => {
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
    newToken = (
      await Assets.setupUserWithCurrencies(
        testUser1,
        [new BN(visibleValueNumber)],
        sudo
      )
    )[0];
    assetName = Assets.getAssetName(newToken.toString());
  });

  it("As a User I can Swap All MGA tokens -> newToken", async () => {
    const amountToMint = new BN(visibleValueNumber).div(new BN(2000));
    await testUser1.createPoolToAsset(
      amountToMint,
      amountToMint,
      newToken,
      MGA_ASSET_ID
    );

    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(assetName);
    await swapView.clickPayMaxBtn();
    const calculatedGet = await swapView.fetchGetAssetAmount();
    await swapView.doSwap();
    await Polkadot.signTransaction(driver);

    await new NotificationModal(driver)
      .waitForModal(ModalType.Confirm)
      .then(async () => await new NotificationModal(driver).clickInDone());

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!).bnEqual(
      new BN(0)
    );
    const walletIncrement = testUser1
      .getAsset(newToken)
      ?.amountAfter.free.sub(testUser1.getAsset(newToken)?.amountBefore.free!);
    const exp18StringToBN = uiStringToBN(calculatedGet);
    expect(walletIncrement).bnEqual(new BN(exp18StringToBN.toString()));
  });

  it("As a User I can mint All tokens newToken - newToken2", async () => {
    const newToken2 = (
      await Assets.setupUserWithCurrencies(
        testUser1,
        [new BN(visibleValueNumber)],
        sudo
      )
    )[0];
    const assetName2 = Assets.getAssetName(newToken2.toString());

    const amountToMint = new BN(visibleValueNumber).div(new BN(2000));
    await testUser1.createPoolToAsset(
      amountToMint,
      amountToMint.sub(new BN(123456)),
      newToken,
      newToken2
    );

    testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = new Mangata(driver);
    await mga.navigate();
    const poolView = new Pool(driver);
    await poolView.togglePool();
    await poolView.selectToken1Asset(assetName);
    await poolView.selectToken2Asset(assetName2);
    await poolView.clickToToken1MaxBtn();
    const calculatedValue = await poolView.getToken2Text();
    await poolView.provideToPool();

    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    await new NotificationModal(driver)
      .waitForModal(ModalType.Confirm)
      .then(async () => await new NotificationModal(driver).clickInDone());
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const poolInvested = await new Sidebar(driver).isLiquidityPoolVisible(
      assetName,
      assetName2
    );
    expect(poolInvested).toBeTruthy();
    expect(testUser1.getAsset(newToken)?.amountAfter.free!).bnEqual(new BN(0));
    const textAsBn = uiStringToBN(calculatedValue);
    //the amount before  - ui value must be lower than the amount extracted.
    // the expected_second_amount set by the UI must be greater than the extracted.
    expect(
      testUser1
        .getAsset(newToken2)
        ?.amountBefore.free.sub(textAsBn)
        ?.lte(testUser1.getAsset(newToken2)?.amountAfter.free!)
    ).toBeTruthy();
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
