/*
 *
 * @group xyk
 * @group rewardsV2Parallel
 * @group validateStatus
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, BN_HUNDRED, BN_ZERO } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  burnLiquidity,
  claimRewardsAll,
  getLiquidityAssetId,
  getRewardsInfo,
  mintLiquidity,
} from "../../utils/tx";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { waitForRewards } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
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

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));
});

beforeEach(async () => {
  await setupApi();

  [testUser1] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1)
  );

  const rewardsInfoBefore = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId
  );
  expect(rewardsInfoBefore.activatedAmount).bnEqual(BN_ZERO);
  expect(rewardsInfoBefore.lastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoBefore.missingAtLastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoBefore.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoBefore.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoBefore.rewardsNotYetClaimed).bnEqual(BN_ZERO);

  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );
});

test("Validate initial status: User just minted on a promoted pool", async () => {
  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );
  expect(rewardsInfoAfter.activatedAmount).bnEqual(defaultCurrencyValue);
  expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.missingAtLastCheckpoint).bnEqual(
    defaultCurrencyValue
  );
  expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(BN_ZERO);
});

test("Validate initial status: User just minted and rewards generated", async () => {
  await waitForRewards(testUser1, liqId);

  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );
  expect(rewardsInfoAfter.activatedAmount).bnEqual(defaultCurrencyValue);
  expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.missingAtLastCheckpoint).bnEqual(
    defaultCurrencyValue
  );
  //expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(BN_ZERO);
});

test("Validate initial status: User just minted on a promoted pool and after rewards being generated mint some more", async () => {
  await waitForRewards(testUser1, liqId);

  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );

  await waitForRewards(testUser1, liqId);

  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );
  expect(rewardsInfoAfter.activatedAmount).bnEqual(
    defaultCurrencyValue.mul(new BN(2))
  );
  expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.missingAtLastCheckpoint).bnGt(
    defaultCurrencyValue.mul(new BN(2)).mul(new BN(98)).div(BN_HUNDRED)
  );
  expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnGt(
    rewardsInfoAfter.rewardsNotYetClaimed
  );
});

test("Validate initial status:  User claims all available tokens that are stored in rewardsToBeClaimed", async () => {
  await waitForRewards(testUser1, liqId);

  const rewardsInfoSubtotal = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  await claimRewardsAll(testUser1, liqId);

  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  expect(rewardsInfoSubtotal.activatedAmount).bnEqual(defaultCurrencyValue);
  expect(rewardsInfoSubtotal.lastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoSubtotal.missingAtLastCheckpoint).bnEqual(
    defaultCurrencyValue
  );
  expect(rewardsInfoSubtotal.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoSubtotal.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoSubtotal.rewardsNotYetClaimed).bnEqual(BN_ZERO);

  expect(rewardsInfoAfter.activatedAmount).bnEqual(defaultCurrencyValue);
  expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.missingAtLastCheckpoint).bnEqual(
    defaultCurrencyValue
  );
  expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnGt(
    rewardsInfoAfter.activatedAmount
  );
});

test("Validate initial status:  User claims all available tokens that are stored in rewardsToBeClaimed and burn some", async () => {
  const api = getApi();

  await waitForRewards(testUser1, liqId);

  await claimRewardsAll(testUser1, liqId);

  const userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liqId
  );

  const rewardsInfoSubtotal = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  const valueBurningTokens = userBalanceBeforeBurning.reserved.div(new BN(2));

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    valueBurningTokens
  );

  const rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  expect(rewardsInfoAfter.activatedAmount).bnEqual(valueBurningTokens);
  expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.missingAtLastCheckpoint).bnGt(BN_ZERO);
  expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(BN_ZERO);
  expect(rewardsInfoSubtotal.activatedAmount).bnGt(
    rewardsInfoAfter.activatedAmount
  );
});
