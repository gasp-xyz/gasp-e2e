/*
 *
 * @group xyk
 * @group liquidity
 */

import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import {
  activateLiquidity,
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
let testUser1: User;
let testUser2: User;
let testUser3: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let token2: BN;
let token3: BN;
let liqIdPool1: BN;
let liqIdPool2: BN;
let liqIdPool3: BN;
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

  [testUser1, testUser2, testUser3] = setupUsers();

  await setupApi();

  [token1, token2, token3] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token3, testUser3, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token3,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqIdPool1 = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqIdPool2 = await getLiquidityAssetId(MGA_ASSET_ID, token2);
  liqIdPool3 = await getLiquidityAssetId(MGA_ASSET_ID, token3);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPool1.toNumber(), 20),
    Assets.mintNative(testUser1)
  );
});

test("GIVEN a promoted pool WHEN more pools gets activated THEN shares are decreased and equally divided among all the activated pools", async () => {
  await activateLiquidity(
    testUser1.keyRingPair,
    liqIdPool1,
    Assets.DEFAULT_AMOUNT.divn(2)
  );
  await waitForRewards(testUser1, liqIdPool1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPool2.toNumber(), 20),
    Assets.promotePool(liqIdPool3.toNumber(), 20),
    Sudo.sudoAs(
      testUser2,
      Xyk.activateLiquidity(liqIdPool2, Assets.DEFAULT_AMOUNT.divn(2))
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.activateLiquidity(liqIdPool3, Assets.DEFAULT_AMOUNT.divn(2))
    ),
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPool1))
  );
  const rewardsInfoOnlyPool1 = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPool1
  );

  await waitForRewards(testUser2, liqIdPool2);
  await waitForRewards(testUser3, liqIdPool3);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPool1)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPool2)),
    Sudo.sudoAs(testUser3, Xyk.claimRewardsAll(liqIdPool3))
  );

  const rewardsInfoPool1Before = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPool1
  );
  const rewardsInfoPool2Before = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPool2
  );
  const rewardsInfoPool3Before = await getRewardsInfo(
    testUser3.keyRingPair.address,
    liqIdPool3
  );

  await waitForRewards(testUser1, liqIdPool1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPool1)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPool2)),
    Sudo.sudoAs(testUser3, Xyk.claimRewardsAll(liqIdPool3))
  );

  const rewardsInfoPool1After = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPool1
  );
  const rewardsInfoPool2After = await getRewardsInfo(
    testUser2.keyRingPair.address,
    liqIdPool2
  );
  const rewardsInfoPool3After = await getRewardsInfo(
    testUser3.keyRingPair.address,
    liqIdPool3
  );
  const differenceRewardPool1 = rewardsInfoPool1After.rewardsAlreadyClaimed
    .sub(rewardsInfoPool1Before.rewardsAlreadyClaimed)
    .sub(rewardsInfoOnlyPool1.rewardsAlreadyClaimed);

  const differenceRewardPool2 = rewardsInfoPool2After.rewardsAlreadyClaimed.sub(
    rewardsInfoPool2Before.rewardsAlreadyClaimed
  );

  const differenceRewardPool3 = rewardsInfoPool3After.rewardsAlreadyClaimed.sub(
    rewardsInfoPool3Before.rewardsAlreadyClaimed
  );

  const ratioRewardPools = differenceRewardPool3
    .mul(new BN(100))
    .div(differenceRewardPool1);

  expect(differenceRewardPool2).bnEqual(differenceRewardPool3);
  //difference between the supposed rewards Pool1 and rewards of the next pools in percent
  expect(ratioRewardPools.sub(new BN(100))).bnLt(new BN(11));
});