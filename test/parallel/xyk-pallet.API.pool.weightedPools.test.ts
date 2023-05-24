/*
 *
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, BN_HUNDRED, BN_ZERO, signTx } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  getLiquidityAssetId,
  getRewardsInfo,
  promotePool,
} from "../../utils/tx";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars, stringToBN } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

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
    Assets.mintNative(testUser1)
  );
});

test("Check that we can get the list of promoted pools with proofOfStake.promotedPoolRewards data storage", async () => {
  const poolWeight = await getPoolWeight(liqId);

  expect(poolWeight).bnGt(BN_ZERO);
});

test("Validate that weight can be modified by using updatePoolPromotion AND only sudo can update weights", async () => {
  const api = getApi();

  const poolWeightBefore = await getPoolWeight(liqId);

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

  const poolWeightAfter = await getPoolWeight(liqId);

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

  //await waitForRewards(testUser1, liqId2);

  const poolWeightLiq1 = await getPoolWeight(liqId);

  const poolWeightLiq2 = await getPoolWeight(liqId2);

  const sumPoolsWeights = poolWeightLiq1.add(poolWeightLiq2);
  const ratioPoolsWeights = poolWeightLiq2.div(poolWeightLiq1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqId)),
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqId2))
  );

  await waitForRewards(testUser1, liqId2);

  const rewardsLiqId1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  const rewardsLiqId2 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId2
  );

  expect(sumPoolsWeights).bnGt(BN_HUNDRED);
  expect(rewardsLiqId1.rewardsAlreadyClaimed.mul(ratioPoolsWeights)).bnLte(
    rewardsLiqId2.rewardsAlreadyClaimed
  );
});

async function getPoolWeight(tokenId: BN) {
  const api = getApi();

  const poolRewards = JSON.parse(
    JSON.stringify(await api.query.proofOfStake.promotedPoolRewards())
  );

  const poolWeight = stringToBN(poolRewards[tokenId.toString()].weight);

  return poolWeight;
}
