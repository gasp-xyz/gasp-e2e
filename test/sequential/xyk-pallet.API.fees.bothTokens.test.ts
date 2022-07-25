/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { getCurrentNonce } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets"
import { AssetWallet, User } from "../../utils/User";;
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { SignerOptions } from "@polkadot/api/types";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { RuntimeDispatchInfo } from "@polkadot/types/interfaces";
import { MGA_ASSET_ID, KSM_ASSET_ID } from "../../utils/Constants";
import { toBN } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let testUser5: User;
let testUser6: User;
let sudo: User;

let keyring: Keyring;
let firstCurrency: BN;
let secondCurrency: BN;
const first_asset_amount = new BN(50000);
const second_asset_amount = new BN(50000);
//creating pool

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

let cost: RuntimeDispatchInfo;

const defaultCurrecyValue = new BN(250000);

export async function UserMintCurrencyToken(
  testUser: User,
  sudo: User,
  firstCurrency: BN,
  secondCurrency: BN,
  CurrencyValue: BN
) {
  await sudo.mint(
    firstCurrency,
    testUser,
    CurrencyValue
  );

  await sudo.mint(
    secondCurrency,
    testUser,
    CurrencyValue
  );
}

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  testUser3 = new User(keyring);
  testUser4 = new User(keyring);
  testUser5 = new User(keyring);
  testUser6 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  //add two curerncies and balance to testUser:
  [firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrecyValue, defaultCurrecyValue],
    sudo
  );

  //add MGA tokens.
  await testUser1.addMGATokens(sudo);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(testUser3.keyRingPair);
  keyring.addPair(testUser4.keyRingPair);
  keyring.addPair(testUser5.keyRingPair);
  keyring.addPair(testUser6.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
  testUser1.addAsset(MGA_ASSET_ID);
  testUser2.addAsset(MGA_ASSET_ID);
  testUser3.addAsset(KSM_ASSET_ID);
  testUser4.addAsset(MGA_ASSET_ID);
  testUser4.addAsset(KSM_ASSET_ID);
  testUser5.addAsset(MGA_ASSET_ID);
  testUser5.addAsset(KSM_ASSET_ID);
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

});

test("xyk-pallet - Calculate required fee - User with MGX only", async () => {

  const api = getApi();
  const nonce = await getCurrentNonce(testUser2.keyRingPair.address);
  const opt: Partial<SignerOptions> = {
    nonce: nonce,
    tip: 0,
  };
  cost = await api?.tx.xyk
    .buyAsset(
    firstCurrency.toString(),
    secondCurrency.toString(),
    new BN(100),
    new BN(1000000)
    )
    .paymentInfo(testUser1.keyRingPair, opt);
  
  //add MGA tokens.
  await testUser2.addMGATokens(sudo);

  //add pool's tokens for user.
  await UserMintCurrencyToken(testUser2, sudo, firstCurrency, secondCurrency, defaultCurrecyValue);

  await testUser2.refreshAmounts(AssetWallet.BEFORE);

  await (await getMangataInstance())
    .buyAsset(
      testUser2.keyRingPair,
      firstCurrency.toString(),
      secondCurrency.toString(),
      new BN(100),
      new BN(1000000)
    )
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

  await testUser2.refreshAmounts(AssetWallet.AFTER);
  const deductedMGATkns = testUser2
      .getAsset(MGA_ASSET_ID)
      ?.amountBefore.free.sub(
        testUser2.getAsset(MGA_ASSET_ID)?.amountAfter.free!
      );
    const fee = cost.partialFee;
    expect(deductedMGATkns).bnLte(fee);

});

test("xyk-pallet - Calculate required fee - User with KSM only", async () => {

  //add pool's tokens for user.
  await UserMintCurrencyToken(testUser3, sudo, firstCurrency, secondCurrency, defaultCurrecyValue);

  //add KSM tokens.
  await sudo.mint(
    KSM_ASSET_ID,
    testUser3,
    new BN(21000000000)
  );

  await testUser3.refreshAmounts(AssetWallet.BEFORE);

  await (await getMangataInstance())
    .buyAsset(
      testUser3.keyRingPair,
      firstCurrency.toString(),
      secondCurrency.toString(),
      new BN(100),
      new BN(1000000)
    )
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

  await testUser3.refreshAmounts(AssetWallet.AFTER);

  const deductedKSMTkns = testUser3
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser3.getAsset(KSM_ASSET_ID)?.amountAfter.free!
    );

  expect(deductedKSMTkns).bnGt(new BN(0));

});

test("xyk-pallet - Calculate required fee - User with very few MGA and some KSM", async () => {

  //add pool's tokens for user.
  await UserMintCurrencyToken(testUser4, sudo, firstCurrency, secondCurrency, defaultCurrecyValue);

   //add few MGX tokens.
   await sudo.mint(
    MGA_ASSET_ID,
    testUser4,
    new BN(100000)
  );

  //add some KSM tokens.
  await sudo.mint(
    KSM_ASSET_ID,
    testUser4,
    new BN(29000000000)
  );

  await testUser4.refreshAmounts(AssetWallet.BEFORE);

  await (await getMangataInstance())
    .buyAsset(
      testUser4.keyRingPair,
      firstCurrency.toString(),
      secondCurrency.toString(),
      new BN(100),
      new BN(1000000)
    )
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

  await testUser4.refreshAmounts(AssetWallet.AFTER);

  const deductedMGATkns = testUser4
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser4.getAsset(MGA_ASSET_ID)?.amountAfter.free!
    );
  const deductedKSMTkns = testUser4
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser4.getAsset(KSM_ASSET_ID)?.amountAfter.free!
    );
   
  
  expect(deductedKSMTkns).bnGt(new BN(0));
  expect(deductedMGATkns).bnEqual(new BN(0));
});

test("xyk-pallet - Calculate required fee - User with some MGA and very few KSM", async () => {

  //add pool's tokens for user.
  await UserMintCurrencyToken(testUser5, sudo, firstCurrency, secondCurrency, defaultCurrecyValue);

  //add some MGX tokens.
  await sudo.mint(
    MGA_ASSET_ID,
    testUser5,
    toBN ('29', 18)
  );

  //add few KSM tokens.
  await sudo.mint(
    KSM_ASSET_ID,
    testUser5,
    new BN(9000000000)
  );

  await testUser5.refreshAmounts(AssetWallet.BEFORE);

  const api = getApi();
  const nonce = await getCurrentNonce(testUser5.keyRingPair.address);
  const opt: Partial<SignerOptions> = {
    nonce: nonce,
    tip: 0,
  };
  cost = await api?.tx.xyk
    .buyAsset(
    firstCurrency.toString(),
    secondCurrency.toString(),
    new BN(100),
    new BN(1000000)
    )
    .paymentInfo(testUser5.keyRingPair, opt);

  await (await getMangataInstance())
  .buyAsset(
    testUser5.keyRingPair,
    firstCurrency.toString(),
    secondCurrency.toString(),
    new BN(100),
    new BN(1000000)
  )
  .then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser5.refreshAmounts(AssetWallet.AFTER);
  const deductedMGATkns = testUser5
    .getAsset(MGA_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser5.getAsset(MGA_ASSET_ID)?.amountAfter.free!
    );
  const deductedKSMTkns = testUser5
    .getAsset(KSM_ASSET_ID)
    ?.amountBefore.free.sub(
      testUser5.getAsset(KSM_ASSET_ID)?.amountAfter.free!
    );
 
  const fee = cost.partialFee;

  expect(deductedMGATkns).bnLte(fee);
  expect(deductedKSMTkns).bnEqual(new BN(0));
  
});

test("xyk-pallet - Calculate required fee - User with very few  MGA and very few KSM", async () => {

  //add pool's tokens for user.
  await UserMintCurrencyToken(testUser6, sudo, firstCurrency, secondCurrency, defaultCurrecyValue);

  //add few MGX tokens.
  await sudo.mint(
    MGA_ASSET_ID,
    testUser6,
    new BN(100000)
  );

  //add few KSM tokens.
  await sudo.mint(
    KSM_ASSET_ID,
    testUser6,
    new BN(9000000000)
  );

  let exception = false;
  const mangata = await getMangataInstance();
  await expect(
    mangata
      .buyAsset(
        testUser6.keyRingPair,
        firstCurrency.toString(),
        secondCurrency.toString(),
        new BN(100),
        new BN(1000000)
      )
      .catch((reason) => {
        exception = true;
        throw new Error(reason.data);
      })
  ).rejects.toThrow(
    "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low"
  );
  expect(exception).toBeTruthy();
  
});