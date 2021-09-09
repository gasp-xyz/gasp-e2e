/*
 *
 * @group ui
 */
import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { FIVE_MIN } from "../../utils/Constants";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { Pool } from "../../utils/frontend/pages/Pool";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  setupAllExtensions,
  takeScreenshot,
} from "../../utils/frontend/utils/Helper";
import { createPool } from "../../utils/tx";
import { getEventResultFromTxWait } from "../../utils/txHandler";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

//Required env vars:
//export API_URL=wss://staging.testnode.mangata.finance:9945
//export UI_URL='https://staging.mangata.finance/' ;
//export MNEMONIC_META='dismiss .. trumpet' ( Ask Gonzalo :) )

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let firstCurrency: BN;
let secondCurrency: BN;

describe("UI tests - Get Tokens from Faucet", () => {
  let testUser1: User;
  let sudo: User;
  let keyring: Keyring;
  const visibleValueNumber = Math.pow(10, 19).toString();

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    keyring = new Keyring({ type: "sr25519" });
    driver = await DriverBuilder.getInstance();

    const { mnemonic } = await setupAllExtensions(driver);

    testUser1 = new User(keyring, undefined);
    testUser1.addFromMnemonic(keyring, mnemonic);

    sudo = new User(keyring, sudoUserName);
    await sudo.mint(new BN(0), testUser1, new BN(visibleValueNumber));
  });
  test.each([
    [
      new BN(Math.pow(10, 19).toString()).div(new BN(2)), //5E19X
      new BN(Math.pow(10, 19).toString()).div(
        new BN(Math.pow(10, 17).toString()) //100Y
      ), // there is a difference of 17 decimals. Pool[ 5E19 X - 100Y]
      "100000000000",
      "0.000002",
    ],
    [
      new BN(Math.pow(10, 19).toString()).div(new BN(2)), //5X
      new BN(Math.pow(10, 19).toString()).div(new BN(2)), //5Y
      "0.123",
      "0.123",
    ],
    [
      new BN(Math.pow(10, 19).toString()).div(new BN(4)), //2.5X
      new BN(Math.pow(10, 19).toString()).div(new BN(2)), //5Y
      "0.100",
      "0.200",
    ],
  ])(
    `As a User I get the right values for Pool investment P[%s, %s] - I-> %s -Expected - %s`,
    async (assetValue1, assetValue2, inputAmount, expectedAmount) => {
      [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
        testUser1,
        [
          new BN(visibleValueNumber).add(new BN(assetValue1)),
          new BN(visibleValueNumber).add(new BN(assetValue2)),
        ],
        sudo
      );

      await createPool(
        testUser1.keyRingPair,
        firstCurrency,
        new BN(assetValue1),
        secondCurrency,
        new BN(assetValue2)
      ).then((result) => {
        const eventResponse = getEventResultFromTxWait(result, [
          "xyk",
          "PoolCreated",
          testUser1.keyRingPair.address,
        ]);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

      const mga = new Mangata(driver);
      await mga.navigate();

      const pool = new Pool(driver);
      await pool.togglePool();
      await pool.selectToken1Asset(`m${firstCurrency}`);
      await pool.selectToken2Asset(`m${secondCurrency}`);
      await pool.addToken1AssetAmount(inputAmount);
      const value = await pool.getToken2Text();
      expect(parseFloat(expectedAmount)).toBe(parseFloat(value));
    }
  );

  afterEach(async () => {
    const session = await driver.getSession();
    await takeScreenshot(
      driver,
      expect.getState().currentTestName + " - " + session
    );
  });

  afterAll(async () => {
    await driver.quit();
    const api = getApi();
    await api.disconnect();
  });
});
