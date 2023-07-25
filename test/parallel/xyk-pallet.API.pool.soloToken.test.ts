/*
 *
 * @group rewardsV2Parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId, getRewardsInfo } from "../../utils/tx";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { BN } from "@polkadot/util";
import { BN_BILLION, BN_MILLION } from "@mangata-finance/sdk";
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
let token2: BN;
let token3: BN;
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

  [token1, token2, token3] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token3, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
        token3,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqId = await getLiquidityAssetId(token2, token3);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(token1.toNumber(), 20),
    Assets.promotePool(liqId.toNumber(), 20)
  );
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(liqId, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1)
  );
});

test("GIVEN pool and solo token AND both were created at the same time AND the activated amounts are similar THEN the available rewards are the same AND when the user claims, it gets the same amounts", async () => {
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.activateLiquidity(liqId, BN_BILLION)),
    Sudo.sudoAs(testUser1, Xyk.activateLiquidity(token1, BN_BILLION))
  );

  await waitForRewards(testUser1, token1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqId)),
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(token1))
  );

  const rewardsSolo = await getRewardsInfo(
    testUser1.keyRingPair.address,
    token1
  );

  const rewardsPool = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  expect(rewardsSolo.rewardsAlreadyClaimed).bnEqual(
    rewardsPool.rewardsAlreadyClaimed
  );
});

test("GIVEN pool and solo token AND both were created at the same time AND the activated amounts are similar AND then some new activation happens after one session and some deactivation THEN the poolRewards storage is the same", async () => {
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.activateLiquidity(liqId, BN_BILLION)),
    Sudo.sudoAs(testUser1, Xyk.activateLiquidity(token1, BN_BILLION))
  );

  await waitForRewards(testUser1, token1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.activateLiquidity(liqId, BN_MILLION)),
    Sudo.sudoAs(testUser1, Xyk.activateLiquidity(token1, BN_MILLION))
  );

  await waitForRewards(testUser1, token1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.deactivateLiquidity(liqId, BN_MILLION)),
    Sudo.sudoAs(testUser1, Xyk.deactivateLiquidity(token1, BN_MILLION))
  );

  const rewardsSolo = await getRewardsInfo(
    testUser1.keyRingPair.address,
    token1
  );

  const rewardsPool = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqId
  );

  expect(rewardsSolo.poolRatioAtLastCheckpoint).bnEqual(
    rewardsPool.poolRatioAtLastCheckpoint
  );
  expect(rewardsSolo.rewardsNotYetClaimed).bnEqual(
    rewardsPool.rewardsNotYetClaimed
  );
});
