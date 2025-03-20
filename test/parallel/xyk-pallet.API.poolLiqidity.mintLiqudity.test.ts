/*
 *
 * @group market
 * @group rewardsV2Parallel
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN_BILLION, BN_ZERO } from "gasp-sdk";
import { GASP_ASSET_ID, MAX_BALANCE } from "../../utils/Constants";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  claimRewards,
  getLiquidityAssetId,
  getRewardsInfo,
  mintLiquidity,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { Market, rpcGetPoolId } from "../../utils/market";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let token1: BN;
let token2: BN;
let liqIdPromPool: BN;
let liqIdNonPromPool: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  [testUser1] = setupUsers();

  await setupApi();

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqIdPromPool = await getLiquidityAssetId(GASP_ASSET_ID, token1);
  liqIdNonPromPool = await getLiquidityAssetId(GASP_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
    Assets.mintNative(testUser1),
  );

  testUser1.addAsset(liqIdPromPool);
  testUser1.addAsset(liqIdNonPromPool);
});

test("Check that a user that mints on a promoted pool liquidity tokens are reserved", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await mintLiquidity(
    testUser1.keyRingPair,
    GASP_ASSET_ID,
    token1,
    defaultCurrencyValue,
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser1
    .getAsset(liqIdPromPool)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountBefore.free!,
    );
  const differenceLiqTokensReserved = testUser1
    .getAsset(liqIdPromPool)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(liqIdPromPool)?.amountBefore.reserved!,
    );

  expect(differenceLiqTokensFree).bnEqual(new BN(0));
  expect(differenceLiqTokensReserved).bnEqual(defaultCurrencyValue);
});

test("Check that a user that mints on a non-promoted pool liquidity tokens are free", async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await mintLiquidity(
    testUser1.keyRingPair,
    GASP_ASSET_ID,
    token2,
    defaultCurrencyValue,
  );
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const differenceLiqTokensFree = testUser1
    .getAsset(liqIdNonPromPool)
    ?.amountAfter.free!.sub(
      testUser1.getAsset(liqIdNonPromPool)?.amountBefore.free!,
    );
  const differenceLiqTokensReserved = testUser1
    .getAsset(liqIdNonPromPool)
    ?.amountAfter.reserved!.sub(
      testUser1.getAsset(liqIdNonPromPool)?.amountBefore.reserved!,
    );

  expect(differenceLiqTokensFree).bnEqual(defaultCurrencyValue);
  expect(differenceLiqTokensReserved).bnEqual(new BN(0));
});

test("Given 3 pool: token1-MGX, token2-MGX and token1-token2 WHEN token1-token2 is promoted THEN user can receive rewards from token1-token2 pool", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  const liqIdThirdPool = await getLiquidityAssetId(token1, token2);
  const rewardsThirdPoolBefore = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdThirdPool,
  );
  await Sudo.batchAsSudoFinalized(
    ProofOfStake.updatePoolPromotion(liqIdThirdPool, 20),
    Sudo.sudoAs(
      testUser1,
      Market.mintLiquidity(
        liqIdThirdPool,
        token1,
        defaultCurrencyValue,
        new BN(Number.MAX_SAFE_INTEGER),
      ),
    ),
  );
  await waitForRewards(testUser1, liqIdThirdPool, 41);
  const mangata = await getMangataInstance(
    getEnvironmentRequiredVars().chainUri,
  );
  const testUser1Rewards = await mangata.rpc.calculateRewardsAmount({
    address: testUser1.keyRingPair.address,
    liquidityTokenId: liqIdThirdPool.toString(),
  });
  await claimRewards(testUser1, liqIdThirdPool);

  const rewardsThirdPoolAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdThirdPool,
  );

  expect(rewardsThirdPoolBefore.activatedAmount).bnEqual(BN_ZERO);
  expect(rewardsThirdPoolAfter.activatedAmount).bnEqual(defaultCurrencyValue);
  expect(rewardsThirdPoolBefore.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(testUser1Rewards).bnLte(rewardsThirdPoolAfter.rewardsAlreadyClaimed);
  expect(testUser1Rewards).bnGt(BN_ZERO);
});

test("Check that the activated amount is equal to the minted one", async () => {
  const [testUser2] = setupUsers();
  const tokenAmount = BN_BILLION.muln(30000000);
  const [token3] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token3, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token3,
        Assets.DEFAULT_AMOUNT.divn(2),
        "StableSwap",
      ),
    ),
  );

  const liqIdStablePool = await rpcGetPoolId(GASP_ASSET_ID, token3);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdStablePool.toNumber(), 20),
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token3, testUser2, tokenAmount.muln(10)),
    Assets.mintNative(testUser2),
  );

  const events = await mintLiquidity(
    testUser2.keyRingPair,
    token3,
    GASP_ASSET_ID,
    tokenAmount,
    MAX_BALANCE,
  );

  const result = getEventResultFromMangataTx(events);
  expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const tokensActivatedValue = events
    .filter(
      (item) =>
        item.method === "LiquidityActivated" && item.section === "proofOfStake",
    )
    .map((x) => new BN(x.eventData[2].data.toString()));

  await testUser2.addAsset(liqIdStablePool);
  await testUser2.refreshAmounts(AssetWallet.AFTER);

  expect(tokensActivatedValue[0]).bnEqual(tokenAmount.muln(2));
  expect(tokensActivatedValue[0]).bnEqual(
    testUser2.getAsset(liqIdStablePool)?.amountAfter.reserved!,
  );
});
