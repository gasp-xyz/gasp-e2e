/*
 *
 * @group xyk
 * @group market
 * @group rewardsV2Parallel
 * @group validateStatus
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "gasp-sdk";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  getLiquidityAssetId,
  getRewardsInfo,
  mintLiquidity,
} from "../../utils/tx";
import { User } from "../../utils/User";
import { waitForRewards } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let sudo: User;
let token1: BN;
let liqId: BN;
const defaultCurrencyValue = new BN(250000);

describe("Validate initial status", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    await setupApi();

    // setup users
    sudo = getSudoUser();

    [testUser, testUser1] = setupUsers();

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
        Market.createPool(
          GASP_ASSET_ID,
          Assets.DEFAULT_AMOUNT.divn(2),
          token1,
          Assets.DEFAULT_AMOUNT.divn(2),
        ),
      ),
    );
    liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);
    await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
      Assets.mintNative(testUser1),
    );

    const rewardsInfoBefore = await getRewardsInfo(
      testUser.keyRingPair.address,
      liqId,
    );
    expect(rewardsInfoBefore.activatedAmount).bnEqual(BN_ZERO);
    expect(rewardsInfoBefore.lastCheckpoint).bnEqual(BN_ZERO);
    expect(rewardsInfoBefore.missingAtLastCheckpoint).bnEqual(BN_ZERO);
    expect(rewardsInfoBefore.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
    expect(rewardsInfoBefore.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
    expect(rewardsInfoBefore.rewardsNotYetClaimed).bnEqual(BN_ZERO);

    await mintLiquidity(
      testUser1.keyRingPair,
      GASP_ASSET_ID,
      token1,
      defaultCurrencyValue,
    );
  });

  test("User just minted on a promoted pool", async () => {
    const rewardsInfoAfter = await getRewardsInfo(
      testUser1.keyRingPair.address,
      liqId,
    );
    expect(rewardsInfoAfter.activatedAmount).bnEqual(defaultCurrencyValue);
    expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
    expect(rewardsInfoAfter.missingAtLastCheckpoint).bnEqual(
      defaultCurrencyValue,
    );
    expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
    expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
    expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(BN_ZERO);
  });

  test("User just minted and rewards generated", async () => {
    await waitForRewards(testUser1, liqId);

    const rewardsInfoAfter = await getRewardsInfo(
      testUser1.keyRingPair.address,
      liqId,
    );
    expect(rewardsInfoAfter.activatedAmount).bnEqual(defaultCurrencyValue);
    expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
    expect(rewardsInfoAfter.missingAtLastCheckpoint).bnEqual(
      defaultCurrencyValue,
    );
    //UPDATE: @mateuszaaa investigated , and it seems to be correct that zero is a valid value on this case.¯\_(ツ)_/¯
    expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnEqual(BN_ZERO);
    expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
    expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(BN_ZERO);
  });

  test("User just minted on a promoted pool and after rewards being generated mint some more", async () => {
    await waitForRewards(testUser1, liqId);

    await mintLiquidity(
      testUser1.keyRingPair,
      GASP_ASSET_ID,
      token1,
      defaultCurrencyValue,
    );

    await waitForRewards(testUser1, liqId);

    const rewardsInfoAfter = await getRewardsInfo(
      testUser1.keyRingPair.address,
      liqId,
    );
    expect(rewardsInfoAfter.activatedAmount).bnEqual(
      defaultCurrencyValue.mul(new BN(2)),
    );
    expect(rewardsInfoAfter.lastCheckpoint).bnGt(BN_ZERO);
    expect(rewardsInfoAfter.missingAtLastCheckpoint).bnEqual(new BN(492718));
    expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnGt(BN_ZERO);
    expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
    expect(rewardsInfoAfter.rewardsNotYetClaimed).bnGt(BN_ZERO);
    expect(rewardsInfoAfter.poolRatioAtLastCheckpoint).bnGt(
      rewardsInfoAfter.rewardsNotYetClaimed,
    );
  });
});
