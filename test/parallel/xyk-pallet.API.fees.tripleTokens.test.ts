/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getCurrentNonce, mintLiquidity } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { SignerOptions } from "@polkadot/api/types";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { RuntimeDispatchInfo } from "@polkadot/types/interfaces";
import {
  MGA_ASSET_ID,
  KSM_ASSET_ID,
  TUR_ASSET_ID,
} from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { setupUsers, setupApi } from "../../utils/setup";
import { Xyk } from "../../utils/xyk";

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

let cost: RuntimeDispatchInfo;

const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);

  //add MGA tokens for creating pool.
  await sudo.addMGATokens(sudo);

  //add two currencies and balance to sudo:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  keyring.addPair(sudo.keyRingPair);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(sudo),
    Xyk.createPool(
      MGA_ASSET_ID,
      first_asset_amount,
      secondCurrency,
      second_asset_amount,
    ),
    Xyk.createPool(
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount,
    ),
  );
});

beforeEach(async () => {
  // setup users
  testUser1 = new User(keyring);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(KSM_ASSET_ID);
  testUser1.addAsset(TUR_ASSET_ID);

  //add pool's tokens for user.
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
  );
});

test("xyk-pallet - Check required fee - User with MGX only", async () => {
  const api = getApi();
  const nonce = await getCurrentNonce(testUser1.keyRingPair.address);
  const opt: Partial<SignerOptions> = {
    nonce: nonce,
    tip: 0,
  };
  cost = await api?.tx.xyk
    .mintLiquidity(
      firstCurrency.toString(),
      new BN(100),
      secondCurrency.toString(),
      new BN(1000000),
    )
    .paymentInfo(testUser1.keyRingPair, opt);

  //add MGA tokens.
  await testUser1.addMGATokens(sudo);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const deductedMGATkns = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!,
    );
  const fee = cost.partialFee;
  expect(deductedMGATkns).bnLte(fee);
  expect(deductedMGATkns).bnGt(new BN(0));
});
test("xyk-pallet - Check required fee - User with KSM only", async () => {
  //add KSM tokens.
  await testUser1.addKSMTokens(sudo);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const deductedKSMTkns = testUser1
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(KSM_ASSET_ID)?.amountAfter.free!,
    );

  expect(deductedKSMTkns).bnGt(new BN(0));
});

test("xyk-pallet - Check required fee - User with TUR only", async () => {
  //add TUR tokens.
  await testUser1.addTURTokens(sudo);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const deductedTURTkns = testUser1
    .getAsset(TUR_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!,
    );

  expect(deductedTURTkns).bnGt(new BN(0));
});

test("xyk-pallet - Check required fee - User with some MGA, very few KSM and very few TUR", async () => {
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintToken(KSM_ASSET_ID, testUser1, new BN(100000)),
    Assets.mintToken(TUR_ASSET_ID, testUser1, new BN(100000)),
  );
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const api = getApi();
  const nonce = await getCurrentNonce(testUser1.keyRingPair.address);
  const opt: Partial<SignerOptions> = {
    nonce: nonce,
    tip: 0,
  };

  cost = await api?.tx.xyk
    .mintLiquidity(
      firstCurrency.toString(),
      new BN(100),
      secondCurrency.toString(),
      new BN(1000000),
    )
    .paymentInfo(testUser1.keyRingPair, opt);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const deductedMGATkns = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!,
    );
  const deductedKSMTkns = testUser1
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(KSM_ASSET_ID)?.amountAfter.free!,
    );
  const deductedTURTkns = testUser1
    .getAsset(TUR_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!,
    );
  const fee = cost.partialFee;

  expect(deductedMGATkns).bnLte(fee);
  expect(deductedMGATkns).bnGt(new BN(0));
  expect(deductedKSMTkns).bnEqual(new BN(0));
  expect(deductedTURTkns).bnEqual(new BN(0));
});

test("xyk-pallet - Check required fee - User with very few MGA, some KSM and very few TUR", async () => {
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(TUR_ASSET_ID, testUser1, new BN(100000)),
    Assets.mintToken(KSM_ASSET_ID, testUser1),
    Assets.mintToken(MGA_ASSET_ID, testUser1, new BN(100000)),
  );
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const deductedMGATkns = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!,
    );
  const deductedKSMTkns = testUser1
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(KSM_ASSET_ID)?.amountAfter.free!,
    );
  const deductedTURTkns = testUser1
    .getAsset(TUR_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!,
    );

  expect(deductedMGATkns).bnEqual(new BN(0));
  expect(deductedKSMTkns).bnGt(new BN(0));
  expect(deductedTURTkns).bnEqual(new BN(0));
});

test("xyk-pallet - Check required fee - User with very few MGA, very few KSM and some TUR", async () => {
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(TUR_ASSET_ID, testUser1),
    Assets.mintToken(KSM_ASSET_ID, testUser1, new BN(100000)),
    Assets.mintToken(MGA_ASSET_ID, testUser1, new BN(100000)),
  );
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser1.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const deductedMGATkns = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!,
    );
  const deductedKSMTkns = testUser1
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(KSM_ASSET_ID)?.amountAfter.free!,
    );
  const deductedTURTkns = testUser1
    .getAsset(TUR_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!,
    );

  expect(deductedMGATkns).bnEqual(new BN(0));
  expect(deductedKSMTkns).bnEqual(new BN(0));
  expect(deductedTURTkns).bnGt(new BN(0));
});

test("xyk-pallet - Check required fee - User with very few  MGA, very few KSM and very few TUR, operation fails", async () => {
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(TUR_ASSET_ID, testUser1, new BN(100000)),
    Assets.mintToken(KSM_ASSET_ID, testUser1, new BN(100000)),
    Assets.mintToken(MGA_ASSET_ID, testUser1, new BN(100000)),
  );
  let exception = false;
  await expect(
    mintLiquidity(
      testUser1.keyRingPair,
      firstCurrency,
      secondCurrency,
      new BN(100),
      new BN(1000000),
    ).catch((reason) => {
      exception = true;
      throw new Error(reason.data);
    }),
  ).rejects.toThrow(
    "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low",
  );
  expect(exception).toBeTruthy();
});
test.skip("BUG under discussion:xyk-pallet - when minting all MGX should pay fees with ksm ?- Check required fee - User with very few MGA, some KSM and very few TUR", async () => {
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(TUR_ASSET_ID, testUser1, new BN(100000)),
    Assets.mintToken(KSM_ASSET_ID, testUser1),
    Assets.mintToken(MGA_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(secondCurrency, testUser1, Assets.DEFAULT_AMOUNT),
  );
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    secondCurrency,
    Assets.DEFAULT_AMOUNT.subn(100000),
    Assets.DEFAULT_AMOUNT,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const deductedMGATkns = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!,
    );
  const deductedKSMTkns = testUser1
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(KSM_ASSET_ID)?.amountAfter.free!,
    );
  const deductedTURTkns = testUser1
    .getAsset(TUR_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!,
    );

  expect(deductedMGATkns).bnEqual(new BN(0));
  expect(deductedKSMTkns).bnGt(new BN(0));
  expect(deductedTURTkns).bnEqual(new BN(0));
});
