/*
 *
 * @group ui
 */
import jp from "jsonpath";

import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";

import {
  NotificationModal,
  ModalType,
} from "../../utils/frontend/pages/NotificationModal";

import { Swap } from "../../utils/frontend/pages/Swap";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";

import {
  setupAllExtensions,
  addExtraLogs,
} from "../../utils/frontend/utils/Helper";

import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { FIVE_MIN, MGA_ASSET_NAME } from "../../utils/Constants";
import { Assets } from "../../utils/Assets";
import { Node } from "../../utils/Framework/Node/Node";

const MGA_ASSET_ID = new BN(0);

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user swapping tokens:", () => {
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

  it("Token amounts are correectly propagated to the node", async () => {
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
    const amountToSell = "1.123456789012345678";
    await swapView.addPayAssetAmount(amountToSell);
    const calculatedGet = await swapView.fetchGetAssetAmount();
    await swapView.doSwap();
    const node = await new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();
    node.subscribeToExtrinsics();
    await Polkadot.signTransaction(driver);

    await new NotificationModal(driver)
      .waitForModal(ModalType.Confirm)
      .then(async () => await new NotificationModal(driver).clickInDone());

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const events = node.systemExtrinics;
    const sellAssetEvents = events.filter((x) =>
      JSON.stringify(x.toHuman()).includes("sellAsset")
    );
    const soldAssetAmounts = sellAssetEvents.map((x) =>
      jp.query(JSON.parse(x), "$..sold_asset_amount")
    );
    const boughtAssetAmounts = sellAssetEvents.map((x) =>
      jp.query(JSON.parse(x), "$..min_amount_out")
    );
    expect([BigInt(amountToSell.replace(".", "")).toString()]).toEqual(
      expect.arrayContaining(
        soldAssetAmounts.flatMap((amount) =>
          BigInt(amount.toString()).toString()
        )
      )
    );
    const minBoughtAmount =
      (BigInt(calculatedGet.replace(".", "")) * BigInt(99)) / BigInt(100);
    expect([minBoughtAmount.toString()]).toEqual(
      expect.arrayContaining(
        boughtAssetAmounts.flatMap((amount) =>
          BigInt(amount.toString()).toString()
        )
      )
    );
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
