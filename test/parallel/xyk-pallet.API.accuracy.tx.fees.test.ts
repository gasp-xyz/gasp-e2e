/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getCurrentNonce, createPool, buyAsset } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { validateAssetsWithValues } from "../../utils/validators";
import { Assets } from "../../utils/Assets";

import { getFeeLockMetadata } from "../../utils/utils";
import { SignerOptions } from "@polkadot/api/types";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { RuntimeDispatchInfo } from "@polkadot/types/interfaces";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Fees } from "../../utils/Fees";
import { BN_ZERO } from "gasp-sdk";
import { getSudoUser } from "../../utils/setup";

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

let cost: RuntimeDispatchInfo;

const defaultCurrecyValue = new BN(250000);

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "ethereum" });

  // setup users
  testUser1 = new User(keyring);
  sudo = getSudoUser();

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue.add(new BN(1))],
    sudo,
  );
  //add zero MGA tokens.
  await testUser1.addGASPTokens(sudo);
  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  testUser1.addAsset(GASP_ASSET_ID);
  // check users accounts.
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  validateAssetsWithValues(
    [
      testUser1.getAsset(firstCurrency)?.amountBefore.free!,
      testUser1.getAsset(secondCurrency)?.amountBefore.free!,
    ],
    [
      defaultCurrecyValue.toNumber(),
      defaultCurrecyValue.add(new BN(1)).toNumber(),
    ],
  );
});

test("xyk-pallet - Calculate required MGA fee - CreatePool", async () => {
  const api = getApi();
  const nonce = await getCurrentNonce(testUser1.keyRingPair.address);
  const opt: Partial<SignerOptions> = {
    nonce: nonce,
    tip: 0,
  };
  cost = await api?.tx.xyk
    .createPool(
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount,
    )
    .paymentInfo(testUser1.keyRingPair, opt);
  await createPool(
    testUser1.keyRingPair,
    firstCurrency,
    first_asset_amount,
    secondCurrency,
    second_asset_amount,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const deductedMGATkns = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.free!,
    );
  const fee = cost.partialFee;
  expect(deductedMGATkns).bnLte(fee);
});

test("xyk-pallet - Calculate required MGA fee - BuyAsset", async () => {
  await testUser1.createPoolToAsset(
    defaultCurrecyValue.div(new BN(10)),
    defaultCurrecyValue.div(new BN(10)),
    firstCurrency,
    secondCurrency,
  );

  //create a pool requires mga, so refreshing wallets.
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const api = getApi();
  const nonce = await getCurrentNonce(testUser1.keyRingPair.address);
  const opt: Partial<SignerOptions> = {
    nonce: nonce,
    tip: 0,
  };

  cost = await api.tx.xyk
    .buyAsset(firstCurrency, secondCurrency, new BN(100), new BN(1000000))
    .paymentInfo(testUser1.keyRingPair, opt);
  await buyAsset(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  const costExpected = Fees.getSwapFees(cost.partialFee);
  expect(cost.partialFee).bnLte(costExpected);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const deductedMGATkns = testUser1
    .getAsset(GASP_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(GASP_ASSET_ID)?.amountAfter.free!,
    );
  const gaslessFee = (await getFeeLockMetadata(await getApi())).feeLockAmount;
  expect(deductedMGATkns?.sub(gaslessFee)).bnLte(BN_ZERO);
});
