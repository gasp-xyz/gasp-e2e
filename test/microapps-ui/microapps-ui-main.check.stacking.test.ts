/*
 *
 * @group microappsUI
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Node } from "../../utils/Framework/Node/Node";
import { WebDriver } from "selenium-webdriver";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { FIVE_MIN } from "../../utils/Constants";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { StakingPageDriver } from "../../utils/frontend/microapps-pages/StakingPage";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let sidebar: Sidebar;
let stakingPageDriver: StakingPageDriver;

const acc_name = "acc_automation";

describe("Microapps UI stacking tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    sidebar = new Sidebar(driver);
    stakingPageDriver = new StakingPageDriver(driver);

    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("The list of active collators matches with the ones in BE", async () => {
    const api = await getApi();

    const listCollatorsBe =
      await api.query.parachainStaking.selectedCandidates();
    const listCollatorsBeString: string[] = [];
    listCollatorsBe.forEach(async (element) => {
      listCollatorsBeString.push(element.toString());
    });
    await setupPageWithState(driver, acc_name);
    await sidebar.clickNavStaking();
    await stakingPageDriver.waitForCollatorsVisible();
    const listCollatorsFe =
      await stakingPageDriver.getCollatorsAddresses("active");
    expect(listCollatorsFe).toIncludeSameMembers(listCollatorsBeString);
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
