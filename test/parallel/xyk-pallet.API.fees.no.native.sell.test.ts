/*
 *
 * @group xyk
 * @group api
 * @group parallel
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { buyAsset } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import BN from "bn.js";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Mangata } from "mangata-sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

const defaultCurrecyValue = new BN(250000);

describe("xyk-pallet - Fees charged in no native", () => {
  let testUser1: User;
  let sudo: User;
  let mga: Mangata;

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
    [firstCurrency] = await Assets.setupUserWithCurrencies(
      sudo,
      [defaultCurrecyValue],
      sudo
    );
    mga = await getMangataInstance();
    await sudo.addMGATokens(sudo);
    await mga.createPool(
      sudo.keyRingPair,
      firstCurrency.toString(),
      new BN(100000),
      MGA_ASSET_ID.toString(),
      new BN(100000)
    );
  });

  //skipped until we finish the Reserve strategy first.
  test.skip("Buy 1 Token - Only 1 asset available - Exp:failure", async () => {
    await sudo.mint(MGA_ASSET_ID, testUser1, new BN(1));
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const result = await buyAsset(
      testUser1.keyRingPair,
      MGA_ASSET_ID,
      firstCurrency,
      new BN(1),
      new BN(0)
    );
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    await testUser1.refreshAmounts(AssetWallet.AFTER);
    expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter!).bnEqual(new BN(0));
  });
});
