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
  deactivateLiquidity,
  getLiquidityAssetId,
  getRewardsInfo,
} from "../../utils/tx";
import { User } from "../../utils/User";
import { Market } from "../../utils/market";
import { BN_ZERO } from "gasp-sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let sudo: User;
let token1: BN;
let liqId: BN;
let miningSplitBefore: number;
let stakingSplitBefore: number;
let sequencersSplitBefore: number;
let splitAmountGeneral: number;
const poolValue = new BN(2500000);

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

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(sudo),
  );

  const issuanceConfigBefore = await Assets.getIssuanceConfig();
  miningSplitBefore = issuanceConfigBefore.liquidityMiningSplit;
  stakingSplitBefore = issuanceConfigBefore.stakingSplit;
  sequencersSplitBefore = issuanceConfigBefore.sequencersSplit;
  splitAmountGeneral =
    issuanceConfigBefore.liquidityMiningSplit +
    issuanceConfigBefore.sequencersSplit +
    issuanceConfigBefore.stakingSplit;
});

test("Compare amount of rewards for 2 difference configuration", async () => {
  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [poolValue.muln(2)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      Market.createPool(GASP_ASSET_ID, poolValue, token1, poolValue),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));

  const [testUser1, testUser2] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(liqId, testUser1, poolValue),
    Assets.mintNative(testUser1),
    Assets.mintToken(liqId, testUser2, poolValue),
    Assets.mintNative(testUser2),
  );

  testUser1.addAssets([GASP_ASSET_ID, liqId]);

  await activateLiquidity(testUser1.keyRingPair, liqId, poolValue.divn(10));

  await waitForRewards(testUser1, liqId);

  const userTokenBeforeClaiming1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId,
  );

  await claimRewards(testUser1, liqId);

  const userTokenAfterClaiming1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId,
  );

  await deactivateLiquidity(testUser1.keyRingPair, liqId, poolValue.divn(10));

  expect(userTokenBeforeClaiming1.activatedAmount).bnGt(BN_ZERO);
  expect(userTokenBeforeClaiming1.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(userTokenAfterClaiming1.rewardsAlreadyClaimed).bnGt(BN_ZERO);

  const miningSplitAfter = miningSplitBefore / 2;
  const stakingSplitAfter = stakingSplitBefore / 2;
  const sequencersSplitAfter =
    splitAmountGeneral - miningSplitAfter - stakingSplitAfter;

  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      getApi().tx.issuance.setIssuanceConfig(
        null,
        null,
        miningSplitAfter,
        stakingSplitAfter,
        sequencersSplitAfter,
      ),
    ),
  );

  testUser2.addAssets([GASP_ASSET_ID, liqId]);

  await activateLiquidity(testUser2.keyRingPair, liqId, poolValue.divn(10));

  await waitForRewards(testUser2, liqId);

  const userTokenBeforeClaiming2 = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqId,
  );

  await claimRewards(testUser2, liqId);

  const userTokenAfterClaiming2 = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqId,
  );

  await deactivateLiquidity(testUser2.keyRingPair, liqId, poolValue.divn(10));

  expect(userTokenBeforeClaiming2.activatedAmount).bnGt(BN_ZERO);
  expect(userTokenBeforeClaiming2.rewardsAlreadyClaimed).bnEqual(BN_ZERO);
  expect(userTokenAfterClaiming2.rewardsAlreadyClaimed).bnGt(BN_ZERO);
  expect(userTokenAfterClaiming2.rewardsAlreadyClaimed).bnEqual(
    userTokenAfterClaiming1.rewardsAlreadyClaimed.divn(2),
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      getApi().tx.issuance.setIssuanceConfig(
        null,
        null,
        miningSplitBefore,
        stakingSplitBefore,
        sequencersSplitBefore,
      ),
    ),
  );
});
