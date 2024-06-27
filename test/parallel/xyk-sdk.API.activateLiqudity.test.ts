/*
 *
 * @group xyk
 * @group sdk
 */
import { jest } from "@jest/globals";
import { BN_ZERO } from "@mangata-finance/sdk";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  activateLiquidity,
  claimRewards,
  deactivateLiquidity,
  getLiquidityAssetId,
  getRewardsInfo,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { Xyk } from "../../utils/xyk";
import { waitForRewards } from "../../utils/eventListeners";
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let sudo: User;
let token1: BN;
let liqId: BN;
const defaultCurrencyValue = new BN(2500000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  [testUser] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));
});

beforeEach(async () => {
  [testUser1] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser1));

  testUser.addAsset(liqId);
  testUser.addAsset(GASP_ASSET_ID);
});

test("Given a user hame some liquidity token THEN he activate them THEN deactivate", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(liqId, testUser1, Assets.DEFAULT_AMOUNT.divn(2)),
  );

  testUser1.addAssets([GASP_ASSET_ID, liqId]);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const userTokenBeforeActivating =
    testUser1.getAsset(liqId)?.amountBefore.reserved!;

  await activateLiquidity(
    testUser1.keyRingPair,
    liqId,
    Assets.DEFAULT_AMOUNT.divn(2),
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userTokenBeforeDeactivating =
    testUser1.getAsset(liqId)?.amountAfter.reserved!;

  await deactivateLiquidity(
    testUser1.keyRingPair,
    liqId,
    Assets.DEFAULT_AMOUNT.divn(2),
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userTokenAfterDeactivating =
    testUser1.getAsset(liqId)?.amountAfter.reserved!;

  expect(userTokenBeforeActivating).bnEqual(BN_ZERO);
  expect(userTokenBeforeDeactivating).bnGt(BN_ZERO);
  expect(userTokenAfterDeactivating).bnEqual(BN_ZERO);
});

test("Activate liquidity and claim rewards", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(liqId, testUser1, Assets.DEFAULT_AMOUNT.divn(2)),
  );

  testUser1.addAssets([GASP_ASSET_ID, liqId]);

  await activateLiquidity(
    testUser1.keyRingPair,
    liqId,
    Assets.DEFAULT_AMOUNT.divn(2),
  );

  await waitForRewards(testUser1, liqId);

  const userTokenBeforeClaiming = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId,
  );

  await claimRewards(testUser1, liqId);

  const userTokenAfterClaiming = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId,
  );

  expect(userTokenBeforeClaiming.activatedAmount).bnGt(BN_ZERO);
  expect(userTokenBeforeClaiming.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(userTokenAfterClaiming.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});
