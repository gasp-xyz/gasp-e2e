/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { ExtrinsicResult } from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

describe("xyk-pallet - Fees charged in no native", () => {
  let testUser1: User;
  let sudo: User;

  let keyring: Keyring;
  let firstCurrency: BN;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    keyring = new Keyring({ type: "sr25519" });

    // setup users
    testUser1 = new User(keyring);

    sudo = new User(keyring, sudoUserName);

    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
  });

  test.skip("TODO: UnSkip when bug gets fixed https://trello.com/c/SeZAOzIn. Buy assets that does not belong to any pool, but will!", async () => {
    await testUser1.addMGATokens(sudo);
    [firstCurrency] = await Assets.setupUserWithCurrencies(
      testUser1,
      [defaultCurrecyValue],
      sudo
    );
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const mga = await getMangataInstance();
    const nonceToCreatePool = await mga.getNonce(testUser1.keyRingPair.address);
    const nonceToBuyAsset = nonceToCreatePool.add(new BN(1));

    const promise1 = mga.createPool(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      new BN(100000),
      MGA_ASSET_ID.toString(),
      new BN(100000),
      { nonce: nonceToCreatePool }
    );
    //uncomment to make it work :)
    //await Promise.all([promise1]);

    const promise2 = mga.buyAsset(
      testUser1.keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      new BN(5000),
      defaultCurrecyValue,
      { nonce: nonceToBuyAsset }
    );
    const results = await Promise.all([promise1, promise2]);
    const poolCreationEvent = getEventResultFromMangataTx(results[0]);
    const buyEvent = getEventResultFromMangataTx(results[1]);
    expect(poolCreationEvent.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    expect(buyEvent.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});
