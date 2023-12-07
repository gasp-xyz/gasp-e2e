/*
 *
 * @group microappsStacking
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import {
  addLiqTokenMicroapps,
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForMicroappsActionNotification,
} from "../../utils/frontend/microapps-utils/Handlers";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { connectVertical } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
//import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { StackingModal } from "../../utils/frontend/microapps-pages/StackingModal";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const INIT_KSM_RELAY = 15;

describe("Microapps UI stacking modal tests", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama({ localPort: 9944 });
    mangata = await XcmNetworks.mangata({ localPort: 9946 });
    await connectVertical(kusama.chain, mangata.chain);
    StashServiceMockSingleton.getInstance().startMock();

    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[userAddress, { token: 4 }], { free: 10 * 1e12 }],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
        ],
      },
      Sudo: {
        Key: userAddress,
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [
          [
            [userAddress],
            { providers: 1, data: { free: INIT_KSM_RELAY * 1e12 } },
          ],
        ],
      },
    });

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(
      keyring,
      getEnvironmentRequiredVars().mnemonicPolkadot,
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("User can enter staking page with list of collators", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stackingModal = new StackingModal(driver);
    const isCollatorsListVisible =
      await stackingModal.isCollatorsListDisplayed();
    expect(isCollatorsListVisible).toBeTruthy();
  });

  it("In staking page user can see active collators with details (staked token, min stake, etc..)", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stackingModal = new StackingModal(driver);
    await stackingModal.waitForCollatorsVisible();
    const collatorInfo = await stackingModal.getCollatorInfo("active");
    expect(collatorInfo.collatorAddress).not.toBeEmpty();
    expect(collatorInfo.totalStake).not.toBeEmpty();
    expect(collatorInfo.minBond).toBeGreaterThan(0);
  });

  it("In staking page user can see waiting collators with details (staked token, min stake, etc..)", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stackingModal = new StackingModal(driver);
    await stackingModal.waitForCollatorsVisible();
    const collatorInfo = await stackingModal.getCollatorInfo("waiting");
    expect(collatorInfo.collatorAddress).not.toBeEmpty();
  });

  it("User can enter active collator details and see its stats", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stackingModal = new StackingModal(driver);
    await stackingModal.waitForCollatorsVisible();
    await stackingModal.chooseCollatorRow();
    const isCollatorsDetailCardVisible =
      await stackingModal.isCollatorsDetailCardDisplayed();
    expect(isCollatorsDetailCardVisible).toBeTruthy();
  });

  it("In collator details page if already stakes user can see his stake", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, 100);
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stackingModal = new StackingModal(driver);
    await stackingModal.waitForCollatorsVisible();
    await stackingModal.chooseCollatorRow();
    await stackingModal.startStacking();
    await stackingModal.setStackingValue("50");
    await stackingModal.waitForStackingFeeVisible();
    await stackingModal.submitStacking();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.Stacking,
      2,
    );
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    StashServiceMockSingleton.getInstance().stopServer();
    await kusama.teardown();
    await mangata.teardown();
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
