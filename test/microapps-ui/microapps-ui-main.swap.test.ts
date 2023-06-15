/*
 *
 * @group microappsUI
 */
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { Node } from "../../utils/Framework/Node/Node";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { Keyring } from "@polkadot/api";
import {
  FIVE_MIN,
  KSM_ASSET_ID,
  MGA_ASSET_ID,
  MGR_ASSET_NAME,
} from "../../utils/Constants";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { Swap } from "../../utils/frontend/microapps-pages/Swap";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;
const acc_name = "acc_automation";

describe("Miocroapps UI smoke tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(
      keyring,
      getEnvironmentRequiredVars().mnemonicPolkadot
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("Swap details", async () => {
    await setupPageWithState(driver, acc_name);
    const swap = new Swap(driver);
    const isSwapFrameDisplayed = await swap.isDisplayed();
    expect(isSwapFrameDisplayed).toBeTruthy();
    await swap.pickPayToken(MGR_ASSET_NAME);
    await swap.pickGetToken("ROC");
  });

  it("Swap not enough", async () => {
    await setupPageWithState(driver, acc_name);
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
