/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { mintLiquidity } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN, BN_TWO, BN_ZERO } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import { AssetWallet, User } from "../../utils/User";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  ARB_ETH_ASSET_ID,
  ETH_ASSET_ID,
  ETH_ASSET_NAME,
  GASP_ASSET_ID,
  GASP_ASSET_NAME,
} from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { setupUsers, setupApi, getSudoUser } from "../../utils/setup";
import { Xyk } from "../../utils/xyk";
import { feeLockErrors } from "../../utils/utils";

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
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "ethereum" });

  sudo = getSudoUser();

  //add GASP tokens for creating pool.
  await sudo.mint(GASP_ASSET_ID, sudo, Assets.DEFAULT_AMOUNT);

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
      GASP_ASSET_ID,
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
  [testUser1] = setupUsers();

  // add users to pair.
  testUser1.addAsset(GASP_ASSET_ID);
  testUser1.addAsset(ETH_ASSET_ID);

  //add pool's tokens for user.
  await setupApi();
  await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(firstCurrency, testUser1, defaultCurrencyValue),
    Assets.mintToken(secondCurrency, testUser1, defaultCurrencyValue),
  );
});

describe.each`
  assetId          | assetName
  ${GASP_ASSET_ID} | ${GASP_ASSET_NAME}
  ${ETH_ASSET_ID}  | ${ETH_ASSET_NAME}
`("xyk-pallet -", ({ assetId, assetName }) => {
  test("User can pay a Tx with only " + assetName, async () => {
    await sudo.mint(assetId, testUser1, Assets.DEFAULT_AMOUNT);

    await runMintingLiquidity(testUser1);

    const deductedTkns = await getDeductedTokens(testUser1, assetId);
    expect(deductedTkns).bnGt(BN_ZERO);
  });
});

test("xyk-pallet - User can't pay a Tx with only Arbitrum-Eth", async () => {
  await sudo.mint(ARB_ETH_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT);
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
  ).rejects.toThrow(feeLockErrors.AccountBalanceFail);
  expect(exception).toBeTruthy();
});

test("xyk-pallet - GIVEN User has enough GASP & enough ETH THEN Fees are charged in GASP", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(GASP_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(ETH_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT),
  );
  const api = getApi();
  const cost = await api?.tx.xyk
    .mintLiquidity(
      firstCurrency.toString(),
      new BN(100),
      secondCurrency.toString(),
      new BN(1000000),
    )
    .paymentInfo(testUser1.keyRingPair);
  const fee = cost.partialFee;

  await runMintingLiquidity(testUser1);

  const deductedGASPTkns = await getDeductedTokens(testUser1, GASP_ASSET_ID);
  const deductedETHTkns = await getDeductedTokens(testUser1, ETH_ASSET_ID);
  expect(deductedGASPTkns).bnLte(fee);
  expect(deductedETHTkns).bnEqual(BN_ZERO);
});

test("xyk-pallet - a very limited amount of GASP & enough ETH THEN Fees are charged in ETH", async () => {
  const api = getApi();
  const cost = await api?.tx.xyk
    .mintLiquidity(
      firstCurrency.toString(),
      new BN(100),
      secondCurrency.toString(),
      new BN(1000000),
    )
    .paymentInfo(testUser1.keyRingPair);
  const fee = cost.partialFee;

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(GASP_ASSET_ID, testUser1, fee.div(BN_TWO)),
    Assets.mintToken(ETH_ASSET_ID, testUser1, Assets.DEFAULT_AMOUNT),
  );

  await runMintingLiquidity(testUser1);

  const deductedGASPTkns = await getDeductedTokens(testUser1, GASP_ASSET_ID);
  const deductedETHTkns = await getDeductedTokens(testUser1, ETH_ASSET_ID);
  expect(deductedGASPTkns).bnEqual(BN_ZERO);
  expect(deductedETHTkns).bnGt(BN_ZERO);
});

async function getDeductedTokens(testUser: User, tokenId: BN) {
  const deductedTokens = testUser
    .getAsset(tokenId)
    ?.amountBefore.free.sub(testUser1.getAsset(tokenId)?.amountAfter.free!);
  return deductedTokens;
}

async function runMintingLiquidity(testUser: User) {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await mintLiquidity(
    testUser.keyRingPair,
    firstCurrency,
    secondCurrency,
    new BN(100),
    new BN(1000000),
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
}
