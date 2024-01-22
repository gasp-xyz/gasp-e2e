/*
 *
 * @group poolLiq
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { BN } from "@polkadot/util";
import "jest-extended";
import {
  claimRewards,
  compoundRewards,
  getLiquidityAssetId,
  getRewardsInfo,
} from "../../utils/tx";
import {
  getBalanceOfPool,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { BN_ZERO } from "@mangata-finance/sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);

process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let liquidityId: BN;
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

  await setupApi();
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
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
        defaultCurrencyValue,
        token1,
        defaultCurrencyValue,
      ),
    ),
  );

  liquidityId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liquidityId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      ProofOfStake.activateLiquidity(liquidityId, defaultCurrencyValue),
    ),
  );

  await waitForRewards(testUser1, liquidityId);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.burnLiquidity(MGA_ASSET_ID, token1, defaultCurrencyValue),
    ),
  );

  const deactivatedPoolBalance = await getBalanceOfPool(MGA_ASSET_ID, token1);

  expect(deactivatedPoolBalance[0][0]).bnEqual(BN_ZERO);
});

test("GIVEN user create a pool, wait for rewards and then deactivate the pool WHEN call RPC calculate_rewards_amount for this user AND user tries to claim rewards THEN value of amount returns AND rewards are claimed", async () => {
  testUser1.addAsset(MGA_ASSET_ID);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const rewardsInfoBefore = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liquidityId,
  );

  const rewardsAmount = await mangata?.rpc.calculateRewardsAmount({
    address: testUser1.keyRingPair.address,
    liquidityTokenId: liquidityId.toString(),
  });

  await claimRewards(testUser1, liquidityId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liquidityId,
  );

  expect(rewardsAmount).bnGt(BN_ZERO);
  expect(testUser1.getAsset(MGA_ASSET_ID)?.amountAfter.free!).bnGt(
    testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
  );
  expect(rewardsInfoBefore.rewardsNotYetClaimed).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(BN_ZERO);
});

test("GIVEN  user create a pool, wait for rewards and then deactivate the pool WHEN the user tries to compound reward on a deactivated pool THEN error returns", async () => {
  await compoundRewards(testUser1, liquidityId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("PoolIsEmpty");
  });
});
