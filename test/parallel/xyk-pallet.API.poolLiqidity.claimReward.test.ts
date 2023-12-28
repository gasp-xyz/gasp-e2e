/*
 *
 * @group xyk
 * @group rewardsV2Parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  activateLiquidity,
  burnLiquidity,
  claimRewards,
  getLiquidityAssetId,
  getRewardsInfo,
  mintLiquidity,
  promotePool,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitNewStakingRound,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { waitForRewards } from "../../utils/eventListeners";
import { getBalanceOfPool } from "../../utils/txHandler";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let token2: BN;
let token3: BN;
let liqIdPromPool1: BN;
let liqIdPromPool2: BN;
let rewardsInfoBefore: any;
let rewardsInfoAfter: any;
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

  [testUser1, testUser2] = setupUsers();

  await setupApi();

  [token1, token2, token3] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1, Assets.DEFAULT_AMOUNT.muln(2)),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Assets.mintToken(token3, testUser1, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token3,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqIdPromPool1 = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqIdPromPool2 = await getLiquidityAssetId(MGA_ASSET_ID, token3);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool1.toNumber(), 20),
    Assets.promotePool(liqIdPromPool2.toNumber(), 20),
    Assets.mintNative(testUser1),
  );
});

test("Check that rewards are generated and can be claimed on each session, then burn all tokens and rewards wont be available", async () => {
  const api = getApi();

  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue,
  );

  await waitForRewards(testUser1, liqIdPromPool1);

  rewardsInfoBefore = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool1,
  );

  await claimRewards(testUser1, liqIdPromPool1);

  rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool1,
  );

  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnGt(
    rewardsInfoBefore.rewardsAlreadyClaimed,
  );

  const userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liqIdPromPool1,
  );

  const valueBurningTokens = userBalanceBeforeBurning.free.add(
    userBalanceBeforeBurning.reserved,
  );

  await waitNewStakingRound();

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    new BN(valueBurningTokens),
  );

  await claimRewards(testUser1, liqIdPromPool1);

  await waitNewStakingRound();

  rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool1,
  );

  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(new BN(0));
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(new BN(0));
});

test("Given a pool with 2 users with activated rewards WHEN more than one period last AND the user burn all liquidity THEN pool is destroyed but users can still claim pending rewards", async () => {
  const liquidityAssetId = await getLiquidityAssetId(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token2,
        Assets.DEFAULT_AMOUNT.divn(4),
        Assets.DEFAULT_AMOUNT,
      ),
    ),
    Assets.promotePool(liquidityAssetId.toNumber(), 20),
  );
  await activateLiquidity(
    testUser1.keyRingPair,
    liquidityAssetId,
    Assets.DEFAULT_AMOUNT.divn(2),
  );
  await activateLiquidity(
    testUser2.keyRingPair,
    liquidityAssetId,
    Assets.DEFAULT_AMOUNT.divn(4),
  );

  await waitForRewards(testUser2, liquidityAssetId);

  const balancePoolBefore = await getBalanceOfPool(MGA_ASSET_ID, token2);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.burnLiquidity(MGA_ASSET_ID, token2, Assets.DEFAULT_AMOUNT.divn(2)),
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.burnLiquidity(MGA_ASSET_ID, token2, Assets.DEFAULT_AMOUNT.divn(4)),
    ),
  );

  const balancePoolAfter = await getBalanceOfPool(MGA_ASSET_ID, token2);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await testUser2.refreshAmounts(AssetWallet.BEFORE);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liquidityAssetId)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liquidityAssetId)),
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  await testUser2.refreshAmounts(AssetWallet.AFTER);

  const differenceMGAUser1 = testUser1
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free.sub(
      testUser1.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
    );

  const differenceMGAUser2 = testUser2
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free.sub(
      testUser2.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
    );

  expect(balancePoolBefore[0][0]).bnGt(BN_ZERO);
  expect(balancePoolAfter[0][0]).bnEqual(BN_ZERO);
  expect(differenceMGAUser1).bnGt(BN_ZERO);
  expect(differenceMGAUser2).bnGt(BN_ZERO);
});

test("Given a pool with user with activated rewards  WHEN it was deactivated AND activated again THEN the user can receive a reward in both a deactivated and activated pool", async () => {
  await activateLiquidity(
    testUser1.keyRingPair,
    liqIdPromPool2,
    Assets.DEFAULT_AMOUNT.divn(2),
  );

  await waitForRewards(testUser1, liqIdPromPool2);

  await promotePool(sudo.keyRingPair, liqIdPromPool2, 0);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPromPool2)),
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const deactivatedPoolRewards = testUser1
    .getAsset(MGA_ASSET_ID)!
    .amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)!.amountBefore.free!,
    );

  await promotePool(sudo.keyRingPair, liqIdPromPool2, 20);

  await waitForRewards(testUser1, liqIdPromPool2);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPromPool2)),
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const activatedPoolRewards = testUser1
    .getAsset(MGA_ASSET_ID)!
    .amountAfter.free!.sub(
      testUser1.getAsset(MGA_ASSET_ID)!.amountBefore.free!,
    );

  expect(deactivatedPoolRewards).bnGt(BN_ZERO);
  expect(activatedPoolRewards).bnGt(BN_ZERO);
});
