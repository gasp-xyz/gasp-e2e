/*
 *
 * @group xyk
 * @group market
 * @group api
 * @group sequential
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  calculate_sell_price_id_rpc,
  calculate_sell_price_local_no_fee,
  getBalanceOfPool,
  getTreasury,
  getTreasuryBurn,
} from "../../utils/tx";
import { BN } from "@polkadot/util";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import {
  findBlockWithExtrinsicSigned,
  getBlockNumber,
  getFeeLockMetadata,
  getTokensDiffForBlockAuthor,
} from "../../utils/utils";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Fees } from "../../utils/Fees";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;

let firstCurrency: BN;
let secondCurrency: BN;
const firstAssetAmount = new BN(50000);
const secondAssetAmount = new BN(50000);
//creating pool

const defaultCurrecyValue = new BN(250000);

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await setupApi();
  await setupUsers();

  // setup users
  [testUser1] = setupUsers();
  sudo = getSudoUser();
  firstCurrency = GASP_ASSET_ID;
  secondCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrecyValue,
    sudo,
    true,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(secondCurrency, testUser1, defaultCurrecyValue),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        GASP_ASSET_ID,
        firstAssetAmount,
        secondCurrency,
        secondAssetAmount,
      ),
    ),
  );
  testUser1.addAsset(firstCurrency, defaultCurrecyValue);
  testUser1.addAsset(secondCurrency, defaultCurrecyValue);
});

test("xyk-pallet - Assets substracted are incremented by 1 - MGA- SellAsset", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const sellingAmount = new BN(10000);
  const tokensToReceive = await calculate_sell_price_id_rpc(
    firstCurrency,
    secondCurrency,
    sellingAmount,
  );

  //10000 - 0.3% = 9970.
  //selling the amount without the fee.
  const exangeValue = await calculate_sell_price_local_no_fee(
    secondAssetAmount,
    firstAssetAmount,
    new BN(9970),
  );
  const treasuryBefore = await getTreasury(firstCurrency);
  const treasuryBurnBefore = await getTreasuryBurn(firstCurrency);
  const from = await getBlockNumber();
  await testUser1.sellAssets(firstCurrency, secondCurrency, sellingAmount);
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  let tokensLost = testUser1
    .getAsset(firstCurrency)
    ?.amountBefore.free.sub(
      testUser1.getAsset(firstCurrency)?.amountAfter.free!,
    );

  const tokensWon = testUser1
    .getAsset(secondCurrency)
    ?.amountAfter.free.sub(
      testUser1.getAsset(secondCurrency)?.amountBefore.free!,
    )!;
  let feesPaid = new BN(0);
  if (Fees.swapFeesEnabled) {
    const to = await getBlockNumber();
    const blockNumber = await findBlockWithExtrinsicSigned(
      [from, to],
      testUser1.keyRingPair.address,
    );
    feesPaid = await getTokensDiffForBlockAuthor(blockNumber);
    tokensLost = tokensLost?.sub(feesPaid);
  }
  const tokensLocked = await (
    await getFeeLockMetadata(await getApi())
  ).feeLockAmount;
  expect(tokensWon).bnEqual(tokensToReceive);
  expect(tokensLost?.sub(tokensLocked)).bnEqual(sellingAmount);
  expect(exangeValue).bnEqual(tokensWon);

  //0.05% = 5 tokens.
  const extraTokenForRounding = new BN(1);
  const expectedTreasury = new BN(5);
  const treasury = await getTreasury(firstCurrency);
  const treasuryBurn = await getTreasuryBurn(firstCurrency);
  // Removed the fees paid. they goes directly to the block author, so treasury has nothing to do with it.
  const incrementedTreasury = treasuryBefore.sub(treasury).abs();
  expect(incrementedTreasury).bnEqual(
    expectedTreasury.add(extraTokenForRounding),
  );
  expect(treasuryBurnBefore.sub(treasuryBurn)).bnEqual(treasuryBurnBefore);

  //the other pool_fee tokens must be in the pool.
  const poolBalance = await getBalanceOfPool(firstCurrency, secondCurrency);
  //adding treasury twice beacuse is burned.
  expect(
    poolBalance[0].add(incrementedTreasury).add(incrementedTreasury),
  ).bnEqual(firstAssetAmount.add(sellingAmount));
});

afterEach(async () => {});
