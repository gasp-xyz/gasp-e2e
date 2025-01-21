import { jest } from "@jest/globals";
import { BN } from "ethereumjs-util/dist/externals";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { waitForRewards } from "../../utils/eventListeners";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  activateLiquidity,
  claimRewards,
  getLiquidityAssetId,
  getRewardsInfo,
} from "../../utils/tx";
import { User } from "../../utils/User";
import { Market } from "../../utils/market";
import { BN_ZERO } from "gasp-sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let sudo: User;
let token1: BN;
let liqId: BN;
let oldConfig: any;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  await setupApi();
  setupUsers();

  await Sudo.batchAsSudoFinalized(Assets.FinalizeTge(), Assets.initIssuance());

  oldConfig = await Assets.getIssuanceConfig();
  expect(oldConfig).not.toBeEmpty();
});

test("Compare amount of rewards for 2 difference configuration", async () => {
  [testUser] = setupUsers();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [new BN(2500000)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
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

  [testUser] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(liqId, testUser, Assets.DEFAULT_AMOUNT.divn(2)),
  );

  testUser.addAssets([GASP_ASSET_ID, liqId]);

  await activateLiquidity(
    testUser.keyRingPair,
    liqId,
    Assets.DEFAULT_AMOUNT.divn(2),
  );

  await waitForRewards(testUser, liqId);

  const userTokenBeforeClaiming = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId,
  );

  await claimRewards(testUser, liqId);

  const userTokenAfterClaiming = await getRewardsInfo(
    testUser.keyRingPair.address,
    liqId,
  );

  expect(userTokenBeforeClaiming.activatedAmount).bnGt(BN_ZERO);
  expect(userTokenBeforeClaiming.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(userTokenAfterClaiming.rewardsAlreadyClaimed).bnGt(BN_ZERO);
});
