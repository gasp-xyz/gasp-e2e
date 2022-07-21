/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets"
import { User } from "../../utils/User";;
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID, KSM_ASSET_ID } from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
const first_asset_amount = new BN(50000);
const second_asset_amount = new BN(50000);
//creating pool

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue],
    sudo
  );

  //add few MGX tokens.
  await sudo.mint(
    MGA_ASSET_ID,
    testUser1,
    new BN(100000)
  );

  //add few KSM tokens.
  await sudo.mint(
    KSM_ASSET_ID,
    testUser1,
    new BN(11000000000)
  );

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(KSM_ASSET_ID);

});

test("xyk-pallet - Calculate required MGA fee - CreatePool and BuyAsset", async () => {

  await (await getMangataInstance())
    .createPool(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      first_asset_amount,
      secondCurrency.toString(),
      second_asset_amount
    )
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

  await (await getMangataInstance())
    .buyAsset(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      secondCurrency.toString(),
      new BN(100),
      new BN(1000000)
    )
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
});
