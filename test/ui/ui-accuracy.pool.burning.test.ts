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
import { BrunLiquidityModal } from "../../utils/frontend/pages/BrunLiquidityModal";
import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  setupAllExtensions,
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

describe("Accuracy tests:", () => {
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
      new BN(Math.pow(10, 19).toString()).sub(new BN(1)).div(new BN(4)), //2.499999X
      new BN(Math.pow(10, 19).toString()).div(new BN(2)), //5Y
      "2",
      "0.050",
      "0.100",
    ],
    [
      new BN(Math.pow(10, 19).toString()).div(new BN(4)), //2.5X
      new BN(Math.pow(10, 19).toString()).div(new BN(2)), //5Y
      "1",
      "0.025",
      "0.05",
    ],
  ])(
    `As a User I get the right values for Pool removal P[%s, %s] - I-> %s -Expected - %s , %s`,
    async (
      assetValue1,
      assetValue2,
      inputAmount,
      expectedAmount1,
      expectedAmount2
    ) => {
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
      const poolAsset1Name = Assets.getAssetName(firstCurrency.toString());
      const poolAsset2Name = Assets.getAssetName(secondCurrency.toString());

      const mga = new Mangata(driver);
      await mga.navigate();
      const sidebar = new Sidebar(driver);
      await sidebar.clickOnLiquidityPool(poolAsset1Name, poolAsset2Name);
      await sidebar.clickOnRemoveLiquidity();
      const liquidityModal = new BrunLiquidityModal(driver);
      await liquidityModal.setAmount(inputAmount);
      const calculatedAsset1 = await liquidityModal.getAssetAmount(
        poolAsset1Name
      );
      const calculatedAsset2 = await liquidityModal.getAssetAmount(
        poolAsset2Name
      );

      expect(parseFloat(expectedAmount1)).toBe(parseFloat(calculatedAsset1));
      expect(parseFloat(expectedAmount2)).toBe(parseFloat(calculatedAsset2));
    }
  );

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
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
