/*
 *
 * @group microappsStaking
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
import { ApiContext, upgradeMangata } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { BuildBlockMode, connectVertical } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_BILLION, BN_THOUSAND } from "@mangata-finance/sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
//import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { StakingPageDriver } from "../../utils/frontend/microapps-pages/StakingPage";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";
import { PositionPageDriver } from "../../utils/frontend/microapps-pages/PositionPage";
import { alice, setupApi, setupUsers, sudo } from "../../utils/setup";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const liqTokenNumber = 10000;
const INIT_KSM_RELAY = 15;
//collators are the bottom of the list will have less stake, therefore the min required will be 1.
const CollatorWithLikelyLessDelegators = 24;

describe("Microapps UI Staking page tests", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let sidebar: Sidebar;
  let stakingPageDriver: StakingPageDriver;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama({
      localPort: 9944,
      buildBlockMode: BuildBlockMode.Instant,
    });
    mangata = await XcmNetworks.mangata({
      localPort: 9946,
      buildBlockMode: BuildBlockMode.Instant,
    });
    await connectVertical(kusama.chain, mangata.chain);
    StashServiceMockSingleton.getInstance().startMock();
    await setupApi();
    setupUsers();
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    testLog.getLog().info(`Sudo address is: ${sudo.keyRingPair.address}`);
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[userAddress, { token: 4 }], { free: 10 * 1e12 }],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
          [
            [alice.keyRingPair.address, { token: 0 }],
            { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
          ],
          [
            [sudo.keyRingPair.address, { token: 0 }],
            { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
          ],
        ],
      },
      Sudo: {
        Key: sudo.keyRingPair.address,
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
    setupUsers();
    await upgradeMangata(mangata);
    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    sidebar = new Sidebar(driver);
    stakingPageDriver = new StakingPageDriver(driver);

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
    await sidebar.clickNavStaking();

    const isCollatorsListVisible =
      await stakingPageDriver.isCollatorsListDisplayed();
    expect(isCollatorsListVisible).toBeTruthy();
  });

  it("In staking page user can see active collators with details (staked token, min stake, etc..)", async () => {
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    const collatorInfo = await stakingPageDriver.getCollatorInfo("active");
    expect(collatorInfo.collatorAddress).not.toBeEmpty();
    expect(collatorInfo.totalStake).not.toBeEmpty();
    expect(collatorInfo.minBond).toBeGreaterThan(0);
  });

  it("In staking page user can see waiting collators with details (staked token, min stake, etc..)", async () => {
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    const collatorInfo = await stakingPageDriver.getCollatorInfo("waiting");
    expect(collatorInfo.collatorAddress).not.toBeEmpty();
  });

  it("User can enter active collator details and see its stats", async () => {
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    await stakingPageDriver.chooseCollatorRow();
    const isCollatorsDetailCardVisible =
      await stakingPageDriver.isCollatorsDetailCardDisplayed();
    expect(isCollatorsDetailCardVisible).toBeTruthy();
  });

  it("In collator details page if already stakes user can see his stake", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    await stakingPageDriver.chooseCollatorRow(CollatorWithLikelyLessDelegators);
    await stakingPageDriver.startStaking();
    await stakingPageDriver.setStakingValue((liqTokenNumber / 2).toString());
    await stakingPageDriver.waitForStakingFeeVisible();
    await stakingPageDriver.submitStaking();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.Stake,
      2,
    );
    await stakingPageDriver.goToPositionInfo();
    const positionPageDriver = new PositionPageDriver(driver);
    await positionPageDriver.waitForLpPositionVisible();
    const tokensValues = await positionPageDriver.getPoolPositionTokensValues();
    expect(tokensValues.liquidityTokenValue).toBeGreaterThan(0);
    expect(tokensValues.firstTokenValue).toBeGreaterThan(0);
    expect(tokensValues.secondTokenValue).toBeGreaterThan(0);
  });

  it("In collator details page if not staking user can see start staking button", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    await stakingPageDriver.chooseCollatorRow(1);
    await stakingPageDriver.waitStartStakingButtonVisible();
    const isStartStakingButtonVisible =
      await stakingPageDriver.isStartStakingButtonDisplayed();
    expect(isStartStakingButtonVisible).toBeTruthy();
  });

  it("User can start staking with enough free tokens", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    await stakingPageDriver.chooseCollatorRow(CollatorWithLikelyLessDelegators);
    await stakingPageDriver.startStaking();
    await stakingPageDriver.setStakingValue((liqTokenNumber / 2).toString());
    await stakingPageDriver.waitForStakingFeeVisible();
    const stakingButtonText = await stakingPageDriver.getStakingButtonText();
    expect(stakingButtonText).toEqual("STAKE");
  });

  it("User can not start staking with more tokens than he owns", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    await stakingPageDriver.chooseCollatorRow(2);
    await stakingPageDriver.startStaking();
    await stakingPageDriver.setStakingValue((liqTokenNumber * 2).toString());
    const stakingButtonText = await stakingPageDriver.getStakingButtonText();
    expect(stakingButtonText).toEqual("INSUFFICIENT BALANCE");
  });

  it("User can not start staking amount less than 1 MGX - KSM", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();

    await stakingPageDriver.waitForCollatorsVisible();
    await stakingPageDriver.chooseCollatorRow(2);
    await stakingPageDriver.startStaking();
    await stakingPageDriver.setStakingValue("0.5");
    await stakingPageDriver.waitForStakingFeeVisible();
    const stakingButtonText = await stakingPageDriver.getStakingButtonText();
    expect(stakingButtonText).toEqual("INSUFFICIENT AMOUNT");
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
