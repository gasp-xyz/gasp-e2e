/*
 *
 * @group rollupStakingListDev
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  extractNumberFromText,
  importMetamaskExtension,
} from "../../utils/frontend/utils/Helper";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/rollup-utils/Handlers";
import { Sidebar } from "../../utils/frontend/rollup-pages/Sidebar";
import { StakingPage } from "../../utils/frontend/rollup-pages/StakingPage";
import { StakingCollatorPage } from "../../utils/frontend/rollup-pages/StakingCollatorPage";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let stakingPage: StakingPage;
let sidebar: Sidebar;
let stakingCollatorPage: StakingCollatorPage;

let acc_addr = "";
let acc_addr_short = "";

describe("Gasp UI staking list tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance(true, true);
    acc_addr = await importMetamaskExtension(driver, true);
    acc_addr_short = acc_addr.slice(-4);
    stakingPage = new StakingPage(driver);
    sidebar = new Sidebar(driver);
    stakingCollatorPage = new StakingCollatorPage(driver);

    await setupPage(driver);
    await connectWallet(driver, "MetaMask", acc_addr_short);
  });

  it("User can enter staking page with list of collators", async () => {
    await setupPageWithState(driver, acc_addr_short);
    await sidebar.clickNavStaking();

    await stakingPage.waitForCollatorsListVisible();
    const isCollatorsListVisible = await stakingPage.isCollatorsListDisplayed();
    expect(isCollatorsListVisible).toBeTruthy();
  });

  it("In staking page user can see active collators with details (staked token, min stake, etc..)", async () => {
    await setupPageWithState(driver, acc_addr_short);
    await sidebar.clickNavStaking();

    await stakingPage.waitForCollatorsVisible();
    const collatorInfo = await stakingPage.getCollatorInfo("active");
    expect(collatorInfo.collatorAddress).not.toBeEmpty();
    expect(collatorInfo.totalStake).not.toBeEmpty();
    expect(collatorInfo.minBond).toBeGreaterThan(0);
  });

  it("User can enter active collator details and see its stats and go back", async () => {
    await setupPageWithState(driver, acc_addr_short);
    await sidebar.clickNavStaking();
    const STAKED_TOKEN = "GASPV2";

    await stakingPage.waitForCollatorsVisible();
    await stakingPage.chooseCollatorRow();
    const isCollatorsDetailCardVisible =
      await stakingCollatorPage.isCollatorsDetailCardDisplayed();
    expect(isCollatorsDetailCardVisible).toBeTruthy();

    const stakigDetails = await stakingCollatorPage.getStakingStats();
    expect(stakigDetails.rewards).toBeGreaterThan(0);
    expect(stakigDetails.minStake).toContain(STAKED_TOKEN);
    expect(extractNumberFromText(stakigDetails.delegators)).toBeGreaterThan(0);
    expect(stakigDetails.totalStake).toContain(STAKED_TOKEN);
    expect(stakigDetails.stakedToken).toContain(STAKED_TOKEN);

    await stakingCollatorPage.clickBack();
    await stakingPage.waitForCollatorsVisible();
    const isCollatorsListVisible = await stakingPage.isCollatorsListDisplayed();
    expect(isCollatorsListVisible).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
