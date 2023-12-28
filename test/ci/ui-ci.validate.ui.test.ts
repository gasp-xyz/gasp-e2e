/*
 *
 * @group ui
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { addExtraLogs } from "../../utils/frontend/utils/Helper";

jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

//Required env vars example:
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

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
    await driver.quit();
    await DriverBuilder.destroy();
  });
});
