import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import {DriverBuilder} from "../../utils/frontend/utils/Driver";
import {takeScreenshot} from "../../utils/frontend/utils/Helper";

jest.setTimeout(1500000);
jest.spyOn(console, 'log').mockImplementation(jest.fn());
let driver: WebDriver;

//Required env vars:
//export API_URL=wss://staging.testnode.mangata.finance:9945
//export UI_URL='https://staging.mangata.finance/' ;

describe('UI tests: Infra', () => {


    beforeAll( async () => {
        
        try {
            getApi();
          } catch(e) {
            await initApi();
        }

	});

    beforeEach( async () => {

        driver = await DriverBuilder.getInstance(false);
        
    });

    it("Validate that Mangata Frontend up and running", async () => {
        
        const mga = new Mangata(driver);
        await mga.go();
        const isLogoDisplayed = await mga.isLogoDisplayed();
        const isMainBoxDisplayed = await mga.isSwapFrameDisplayed()
        expect(isLogoDisplayed).toBeTruthy();
        expect(isMainBoxDisplayed).toBeTruthy();

    });

    afterEach( async () => {
        const session = await driver.getSession();
        await takeScreenshot(driver, expect.getState().currentTestName + " - " + session);
        await driver.quit();
        const api = getApi();
        await api.disconnect();
    });
});
