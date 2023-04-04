/*
 *
 * @group xyk
 * @group poolliquidity
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId, getRewardsInfo } from "../../utils/tx";
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
let token1: BN;
let token2: BN;
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

  [token1, token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(2)),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  testUser1.addAsset(liqIdPromPool);
  testUser1.addAsset(token1);
  testUser2.addAsset(liqIdPromPool);
  testUser2.addAsset(token1);
});

test("Users minted a different number of tokens THEN they receive an equivalent amount of rewards", async () => {
  await promotePool(token1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token1,
        defaultCurrencyValue.mul(new BN(2))
      )
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(MGA_ASSET_ID, token1, defaultCurrencyValue)
    )
  );

  await waitForRewards(testUser1, liqIdPromPool);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPromPool)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPromPool))
  );

  const rewardsInfoUser1Before = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  const rewardsInfoUser2Before = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPromPool
  );

  await waitForRewards(testUser1, liqIdPromPool);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPromPool)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPromPool))
  );

  const rewardsInfoUser1After = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  const rewardsInfoUser2After = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPromPool
  );
  const rewardsClaimedUser1 = rewardsInfoUser1After.rewardsAlreadyClaimed.sub(
    rewardsInfoUser1Before.rewardsAlreadyClaimed
  );
  const rewardsClaimedUser2 = rewardsInfoUser2After.rewardsAlreadyClaimed.sub(
    rewardsInfoUser2Before.rewardsAlreadyClaimed
  );

  const differenceUsersRewardsClaimed = rewardsClaimedUser2
    .mul(new BN(2))
    .div(rewardsClaimedUser1);

  expect(differenceUsersRewardsClaimed).bnLte(new BN(2));
});

test("One user mints X tokens, other mints those X tokens but splitted in 5 mints at the same block, rewards are equal", async () => {
  await promotePool(token2);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, token2, defaultCurrencyValue)
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token2,
        defaultCurrencyValue.div(new BN(5))
      )
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token2,
        defaultCurrencyValue.div(new BN(5))
      )
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token2,
        defaultCurrencyValue.div(new BN(5))
      )
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token2,
        defaultCurrencyValue.div(new BN(5))
      )
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token2,
        defaultCurrencyValue.div(new BN(5))
      )
    )
  );

  await waitForRewards(testUser1, liqIdPromPool);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPromPool)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPromPool))
  );

  const rewardsInfoUser1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  const rewardsInfoUser2 = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPromPool
  );

  expect(rewardsInfoUser1.rewardsAlreadyClaimed).bnEqual(
    rewardsInfoUser2.rewardsAlreadyClaimed
  );
});

async function promotePool(token: BN) {
  liqIdPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20)
  );
}
