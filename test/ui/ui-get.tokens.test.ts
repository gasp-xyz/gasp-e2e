import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import {DriverBuilder} from "../../utils/frontend/utils/Driver";
import {setupAllExtensions} from "../../utils/frontend/utils/Helper";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.setTimeout(1500000);
jest.spyOn(console, 'log').mockImplementation(jest.fn());
const {sudo:sudoUserName, uiUserPassword:userPassword} = getEnvironmentRequiredVars();
let driver: WebDriver;

//export API_URL=wss://staging.testnode.mangata.finance:9945
describe('UI tests - Get Tokens from Faucet', () => {

    let testUser1: User;

    beforeAll( async () => {
        
        try {
            getApi();
          } catch(e) {
            await initApi();
        }
        driver = DriverBuilder.getInstance();

        const keyring = new Keyring({ type: 'sr25519' });
		// setup users
        const json = new Polkadot(driver).getAccountJSON();
		
        testUser1 = new User(keyring,undefined, json);
        keyring.addPair(testUser1.keyRingPair);
        keyring.pairs[0].decodePkcs8(userPassword);
        let sudo = new User(keyring, sudoUserName);
        await testUser1.setBalance(sudo);

	});

    beforeEach( async () => {
        await testUser1.removeTokens();
        await setupAllExtensions(driver);

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
        await driver.quit();
        const api = getApi();
        await api.disconnect()
    });
});
