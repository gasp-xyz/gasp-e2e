/*
 *
 * @group api
 * @group parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, BN_HUNDRED, BN_ZERO, signTx } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  claimRewardsAll,
  getLiquidityAssetId,
  getRewardsInfo,
  mintLiquidity,
  promotePool,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars, stringToBN } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let liqId: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  [testUser1] = setupUsers();

  await setupApi();
});

beforeEach(async () => {
  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.activateLiquidity(liqId, Assets.DEFAULT_AMOUNT.divn(2))
    )
  );
});

test("Check that we can get the list of promoted pools with proofOfStake.promotedPoolRewards data storage", async () => {
  const poolWeight = (await getPromotedPoolInfo(liqId)).weight;

  expect(poolWeight).bnEqual(new BN(20));
});

test("Validate that weight can be modified by using updatePoolPromotion AND only sudo can update weights", async () => {
  const api = getApi();

  const poolWeightBefore = (await getPromotedPoolInfo(liqId)).weight;

  await signTx(
    api,
    api.tx.proofOfStake.updatePoolPromotion(
      liqId,
      poolWeightBefore.div(new BN(2))
    ),
    testUser1.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("UnknownError");
  });

  await promotePool(
    sudo.keyRingPair,
    liqId,
    poolWeightBefore.div(new BN(2)).toNumber()
  );

  const poolWeightAfter = (await getPromotedPoolInfo(liqId)).weight;

  expect(poolWeightAfter).bnEqual(poolWeightBefore.div(new BN(2)));
});

test("Testing that the sum of the weights can be greater than 100", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  const liqId2 = await getLiquidityAssetId(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId2.toNumber(), 100),
    Sudo.sudoAs(
      testUser1,
      Xyk.activateLiquidity(liqId, Assets.DEFAULT_AMOUNT.divn(2))
    ),
    Sudo.sudoAs(
      testUser1,
      Xyk.activateLiquidity(liqId2, Assets.DEFAULT_AMOUNT.divn(2))
    )
  );

  const poolWeightLiq1 = (await getPromotedPoolInfo(liqId)).weight;

  const poolWeightLiq2 = (await getPromotedPoolInfo(liqId2)).weight;

  const sumPoolsWeights = poolWeightLiq1.add(poolWeightLiq2);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqId)),
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqId2))
  );

  const rewardsLiqId1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  const rewardsLiqId2 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId2
  );

  expect(sumPoolsWeights).bnGt(BN_HUNDRED);
  expect(rewardsLiqId1.rewardsAlreadyClaimed).bnLte(
    rewardsLiqId2.rewardsAlreadyClaimed
  );
});

test("GIVEN a pool WHEN it has configured with 0 THEN no new issuance will be reserved AND user can't claim rewards", async () => {
  const [testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, token1, defaultCurrencyValue)
    )
  );

  testUser2.addAsset(MGA_ASSET_ID);
  testUser2.addAsset(token1);

  await waitForRewards(testUser1, liqId);

  await claimRewardsAll(testUser1, liqId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitForRewards(testUser1, liqId);

  await promotePool(sudo.keyRingPair, liqId, 0);

  await claimRewardsAll(testUser1, liqId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NotAPromotedPool");
  });

  await mintLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );

  await testUser2.refreshAmounts(AssetWallet.AFTER);

  expect(testUser2.getAsset(MGA_ASSET_ID)!.amountAfter.free!).bnGt(BN_ZERO);
  expect(testUser2.getAsset(MGA_ASSET_ID)!.amountAfter.reserved!).bnEqual(
    BN_ZERO
  );
});

test("GIVEN a deactivated pool WHEN its configured with more weight, THEN rewards are now active, new users can get portion of those rewards AND issuance grows", async () => {
  await waitForRewards(testUser1, liqId);

  const poolRewardsBefore = (await getPromotedPoolInfo(liqId)).rewards;

  await promotePool(sudo.keyRingPair, liqId, 0);

  const [testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2)
  );

  await promotePool(sudo.keyRingPair, liqId, 20);

  await mintLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );

  await waitForRewards(testUser2, liqId);

  const poolRewardsAfter = (await getPromotedPoolInfo(liqId)).rewards;

  expect(poolRewardsBefore).bnGt(BN_ZERO);
  expect(poolRewardsAfter).bnGt(poolRewardsBefore);
});

test("GIVEN an activated pool WHEN pool was deactivated THEN check that pool was deleted from list of promotedPoolRewards", async () => {
  const api = getApi();

  const poolWeightBefore = (await getPromotedPoolInfo(liqId)).weight;

  await promotePool(sudo.keyRingPair, liqId, 0);

  const poolRewards = JSON.parse(
    JSON.stringify(await api.query.proofOfStake.promotedPoolRewards())
  );

  expect(poolWeightBefore).bnGt(BN_ZERO);
  expect(poolRewards[liqId.toString()]).toEqual(undefined);
});

async function getPromotedPoolInfo(tokenId: BN) {
  const api = getApi();

  const poolRewards = JSON.parse(
    JSON.stringify(await api.query.proofOfStake.promotedPoolRewards())
  );
  const results = {
    weight: stringToBN(poolRewards[tokenId.toString()].weight),
    rewards: stringToBN(poolRewards[tokenId.toString()].rewards),
  };

  return results;
}
