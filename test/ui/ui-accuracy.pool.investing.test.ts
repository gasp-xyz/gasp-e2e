/*
 * @group ui
 * 
 */

import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import {DriverBuilder} from "../../utils/frontend/utils/Driver";
import {setupAllExtensions, takeScreenshot} from "../../utils/frontend/utils/Helper";
import { createPool } from "../../utils/tx";
import { getEventResultFromTxWait } from "../../utils/txHandler";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.setTimeout(1500000);
jest.spyOn(console, 'log').mockImplementation(jest.fn());
let driver: WebDriver;

//Required env vars:
//export API_URL=wss://staging.testnode.mangata.finance:9945
//export UI_URL='https://staging.mangata.finance/' ;
//export MNEMONIC_META='dismiss .. trumpet' ( Ask Gonzalo :) )

const {sudo:sudoUserName} = getEnvironmentRequiredVars();
var firstCurrency : BN; 
var secondCurrency : BN; 


describe('UI tests - Get Tokens from Faucet', () => {

    let testUser1: User;
    let sudo: User;
    let keyring : Keyring;
    let visibleValueNumber = Math.pow(10,19).toString();

    beforeAll( async () => {
        
        try {
            getApi();
          } catch(e) {
            await initApi();
        }

        keyring = new Keyring({ type: 'sr25519' });
        driver = await DriverBuilder.getInstance();
        
        const {mnemonic}  = await setupAllExtensions(driver);

        testUser1 = new User(keyring,undefined);
        testUser1.addFromMnemonic(keyring, mnemonic);

        sudo = new User(keyring, sudoUserName);
        await sudo.mint(new BN(0),testUser1,new BN(visibleValueNumber));
	});
    beforeEach( async () => {
        [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [new BN(visibleValueNumber),new BN(visibleValueNumber)], sudo);

    })
    ///TODO: Extend when locators available.Right now I can not select more liq. pools- I dont have Ids, and I dont have asset names :S
    test.each([
        [       new BN(Math.pow(10,19).toString()).div(new BN(2)), 
                new BN(Math.pow(10,19).toString()).div(new BN(2)),
                '0.123',
                '0.123'
        ],
    ])
    ("As a User I get the right values for Pool investment", async (assetValue1,assetValue2, inputAmount, expectedAmount) => {
        await createPool(testUser1.keyRingPair, firstCurrency, new BN(assetValue1), secondCurrency, new BN(assetValue2))
        .then(
          (result) => {
              const eventResponse = getEventResultFromTxWait(result, ["xyk","PoolCreated", testUser1.keyRingPair.address]);
              expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
          }
        );

        const mga = new Mangata(driver);
        await mga.navigate();
        await mga.clickOnFirstOwnedLiquidityPool();
        await mga.clickOnAddLiquidityPoolBtn();
        await mga.addAmount(inputAmount,1);
        const value = await mga.getAmount(2);
        expect(parseFloat(expectedAmount)).toBe(parseFloat(value));
    });

    afterEach( async () => {
        const session = await driver.getSession();
        await takeScreenshot(driver, expect.getState().currentTestName + " - " + session);
        await driver.quit();
        const api = getApi();
        await api.disconnect();
    });
});
