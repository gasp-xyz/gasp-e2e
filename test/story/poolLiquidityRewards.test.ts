/*
 *
 * @group rewardsv2
 * @group story
 */

import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import {
  mintLiquidity,
  activateLiquidity,
  getLiquidityAssetId,
  promotePool,
  deactivateLiquidity,
} from "../../utils/tx";
import { setupApi, setupUsers } from "../../utils/setup";
import { ExtrinsicResult } from "../../utils/eventListeners";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);
const assetAmount = new BN(10000);

let testUser1: User;
let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await setupApi();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        firstCurrency,
        defaultPoolVolumeValue,
        secondCurrency,
        defaultPoolVolumeValue
      )
    )
  );
});

test("Given a user with Liquidity on non promoted pool When tries to activate Then extrinsic fail", async () => {
  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    assetAmount
  );

  const liquidityAssetId = await getLiquidityAssetId(
    firstCurrency,
    secondCurrency
  );

  await activateLiquidity(
    testUser1.keyRingPair,
    liquidityAssetId,
    assetAmount
  ).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("NotAPromotedPool");
  });
});

test("Given a user with Liquidity activated When tries to deactivate Then the user gets all tokens burn and rewards amount are readable in RPC THEN the user can claim them", async () => {
  const liquidityAssetId = await getLiquidityAssetId(
    firstCurrency,
    secondCurrency
  );

  await promotePool(sudo.keyRingPair, liquidityAssetId);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    assetAmount
  );

  await activateLiquidity(testUser1.keyRingPair, liquidityAssetId, assetAmount);

  await deactivateLiquidity(
    testUser1.keyRingPair,
    liquidityAssetId,
    assetAmount
  );
});
