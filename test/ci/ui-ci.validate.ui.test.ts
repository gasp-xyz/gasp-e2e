/*
 *
 * @group ui
 */

import { WebDriver } from "selenium-webdriver";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { addExtraLogs } from "../../utils/frontend/utils/Helper";
import { sleep } from "../../utils/utils";

jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

//Required env vars:
//export API_URL=wss://staging.testnode.mangata.finance:9945
//export UI_URL='https://staging.mangata.finance/' ;

describe("UI tests: Infra", () => {
  beforeEach(async () => {
    driver = await DriverBuilder.getInstance(false);
  });

  it("Validate that Mangata Frontend up and running", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    const isLogoDisplayed = await mga.isLogoDisplayed();
    const isMainBoxDisplayed = await mga.isSwapFrameDisplayed();
    expect(isLogoDisplayed).toBeTruthy();
    expect(isMainBoxDisplayed).toBeTruthy();
  });

  it("Validate that Frontend retrieves AssetInfo data", async () => {
    const mga = new Mangata(driver);
    await mga.go();
    //lets wait 10 secs for page to load.
    //TODO: improve this and wait until spinner dissapears.
    await sleep(10000);
    await mga.clickOnSelectTokens();
    const tokenList = await mga.getAvailableTokenList();

    expect(
      tokenList.find((tokenElement) => tokenElement.includes("MGA"))
    ).toBeTruthy();
    expect(
      tokenList.find((tokenElement) => tokenElement.includes("Mangata"))
    ).toBeTruthy();
    expect(
      tokenList.find((tokenElement) => tokenElement.includes("mETH"))
    ).toBeTruthy();
    expect(
      tokenList.find((tokenElement) => tokenElement.includes("mEthereum"))
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
});
