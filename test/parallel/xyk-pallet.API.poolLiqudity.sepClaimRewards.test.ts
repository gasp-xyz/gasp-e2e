/*
 *
 * @group xyk
 * @group poolLiq
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  claimRewards,
  getLiquidityAssetId,
  getRewardsInfo,
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
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let token: BN;
let liqIdPromPool: BN;
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

  [testUser, testUser1, testUser2] = setupUsers();

  await setupApi();

  [token] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser),
    Assets.mintToken(token, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintToken(token, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );
});

test("One user claim all the rewards on every session and other user claim them at the 3rd session, the sum of rewards are equal", async () => {
  liqIdPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
  );
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, token, defaultCurrencyValue),
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(MGA_ASSET_ID, token, defaultCurrencyValue),
    ),
  );

  await waitForRewards(testUser1, liqIdPromPool);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPromPool)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPromPool)),
  );

  const rewardsInfoUser1Before = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool,
  );

  const rewardsInfoUser2Before = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPromPool,
  );

  for (let index = 0; index < 2; index++) {
    await waitForRewards(testUser1, liqIdPromPool);

    await claimRewards(testUser1, liqIdPromPool);
  }

  await waitForRewards(testUser1, liqIdPromPool);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPromPool)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPromPool)),
  );

  const rewardsInfoUser1After = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool,
  );

  const rewardsInfoUser2After = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPromPool,
  );
  const rewardsClaimedUser1 = rewardsInfoUser1After.rewardsAlreadyClaimed.sub(
    rewardsInfoUser1Before.rewardsAlreadyClaimed,
  );
  const rewardsClaimedUser2 = rewardsInfoUser2After.rewardsAlreadyClaimed.sub(
    rewardsInfoUser2Before.rewardsAlreadyClaimed,
  );

  expect(rewardsClaimedUser1).bnEqual(rewardsClaimedUser2);
  expect(rewardsInfoUser1After.activatedAmount).bnEqual(
    rewardsInfoUser2After.activatedAmount,
  );
  expect(rewardsInfoUser1After.rewardsNotYetClaimed).bnEqual(
    rewardsInfoUser2After.rewardsNotYetClaimed,
  );
  expect(rewardsInfoUser1After.rewardsAlreadyClaimed).bnEqual(
    rewardsInfoUser2After.rewardsAlreadyClaimed,
  );
  expect(rewardsInfoUser1After.lastCheckpoint).bnEqual(
    rewardsInfoUser2After.lastCheckpoint,
  );
  expect(rewardsInfoUser1After.poolRatioAtLastCheckpoint).bnEqual(
    rewardsInfoUser2After.poolRatioAtLastCheckpoint,
  );
  expect(rewardsInfoUser1After.missingAtLastCheckpoint).bnEqual(
    rewardsInfoUser2After.missingAtLastCheckpoint,
  );
});
