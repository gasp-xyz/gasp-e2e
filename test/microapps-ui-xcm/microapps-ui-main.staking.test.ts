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
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { connectVertical } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
//import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { StakingModal } from "../../utils/frontend/microapps-pages/StakingModal";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";
import { PositionModal } from "../../utils/frontend/microapps-pages/PositionModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const liqTokenNumber = 100;
const INIT_KSM_RELAY = 15;

describe("Microapps UI staking modal tests", () => {
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

    const stakingModal = new StakingModal(driver);
    const isCollatorsListVisible =
      await stakingModal.isCollatorsListDisplayed();
    expect(isCollatorsListVisible).toBeTruthy();
  });

  it("In staking page user can see active collators with details (staked token, min stake, etc..)", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    const collatorInfo = await stakingModal.getCollatorInfo("active");
    expect(collatorInfo.collatorAddress).not.toBeEmpty();
    expect(collatorInfo.totalStake).not.toBeEmpty();
    expect(collatorInfo.minBond).toBeGreaterThan(0);
  });

  it("In staking page user can see waiting collators with details (staked token, min stake, etc..)", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    const collatorInfo = await stakingModal.getCollatorInfo("waiting");
    expect(collatorInfo.collatorAddress).not.toBeEmpty();
  });

  it("User can enter active collator details and see its stats", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    await stakingModal.chooseCollatorRow();
    const isCollatorsDetailCardVisible =
      await stakingModal.isCollatorsDetailCardDisplayed();
    expect(isCollatorsDetailCardVisible).toBeTruthy();
  });

  it("In collator details page if already stakes user can see his stake", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    await stakingModal.chooseCollatorRow();
    await stakingModal.startStaking();
    await stakingModal.setStakingValue((liqTokenNumber / 2).toString());
    await stakingModal.waitForStakingFeeVisible();
    await stakingModal.submitStaking();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.Stake,
      2,
    );
    await stakingModal.goToPositionInfo();

    const positionModal = new PositionModal(driver);
    await positionModal.waitForLpPositionVisible();
    const tokensValues = await positionModal.getPoolPositionTokensValues();
    expect(tokensValues.liquidityTokenValue).toBeGreaterThan(0);
    expect(tokensValues.firstTokenValue).toBeGreaterThan(0);
    expect(tokensValues.secondTokenValue).toBeGreaterThan(0);
  });

  it("In collator details page if not staking user can see start staking button", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    await stakingModal.chooseCollatorRow(1);
    await stakingModal.waitStartStakingButtonVisible();
    const isStartStakingButtonVisible =
      await stakingModal.isStartStakingButtonDisplayed();
    expect(isStartStakingButtonVisible).toBeTruthy();
  });

  it("User can start staking with enough free tokens", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    await stakingModal.chooseCollatorRow(2);
    await stakingModal.startStaking();
    await stakingModal.setStakingValue((liqTokenNumber / 2).toString());
    await stakingModal.waitForStakingFeeVisible();
    const stakingButtonText = await stakingModal.getStakingButtonText();
    expect(stakingButtonText).toEqual("STAKE");
  });

  it("User can not start staking with more tokens than he owns", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    await stakingModal.chooseCollatorRow(2);
    await stakingModal.startStaking();
    await stakingModal.setStakingValue((liqTokenNumber * 2).toString());
    const stakingButtonText = await stakingModal.getStakingButtonText();
    expect(stakingButtonText).toEqual("INSUFFICIENT BALANCE");
  });

  it("User can not start staking amount less than 1 MGX - KSM", async () => {
    await addLiqTokenMicroapps(userAddress, mangata, 5, 18, liqTokenNumber);
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavStaking();

    const stakingModal = new StakingModal(driver);
    await stakingModal.waitForCollatorsVisible();
    await stakingModal.chooseCollatorRow(2);
    await stakingModal.startStaking();
    await stakingModal.setStakingValue("0.5");
    await stakingModal.waitForStakingFeeVisible();
    const stakingButtonText = await stakingModal.getStakingButtonText();
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
