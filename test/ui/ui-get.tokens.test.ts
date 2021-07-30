import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import {DriverBuilder} from "../../utils/frontend/utils/Driver";
import {getAccountJSON, setupAllExtensions, takeScreenshot} from "../../utils/frontend/utils/Helper";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.setTimeout(1500000);
jest.spyOn(console, 'log').mockImplementation(jest.fn());
const {sudo:sudoUserName, uiUserPassword:userPassword} = getEnvironmentRequiredVars();
let driver: WebDriver;

//export API_URL=wss://staging.testnode.mangata.finance:9945
describe('UI tests - Get Tokens from Faucet', () => {

    let testUser1: User;
    let keyring : Keyring;

    beforeAll( async () => {
        
        try {
            getApi();
          } catch(e) {
            await initApi();
        }

        keyring = new Keyring({ type: 'sr25519' });
	});

    beforeEach( async () => {

        driver = await DriverBuilder.getInstance();
        
        const {polkUserAddress}  = await setupAllExtensions(driver);

        testUser1 = new User(keyring,undefined);
        testUser1.addFromAddress(keyring, polkUserAddress);

    });

    it("As a User I can get test tokens from the faucet", async () => {
        
        const mga = new Mangata(driver);
        await mga.navigate();
        const getTokensAvailable = await mga.isGetTokensVisible();
        expect(getTokensAvailable).toBeTruthy();
        await mga.clickOnGetTokens();
        await mga.waitForFaucetToGenerateTokens();
        const tokens = await mga.getAssetValue();
        expect(tokens).toBe('10.000');
    });

    afterEach( async () => {
        const session = await driver.getSession();
        await takeScreenshot(driver, expect.getState().currentTestName + " - " + session);
        await driver.quit();
        const api = getApi();
        await api.disconnect();
    });
});
