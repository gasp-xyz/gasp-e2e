/*
 *
 * @group xyk
 * @group poolliquidity
 */

import { Keyring } from "@polkadot/api";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
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
import {
  getEnvironmentRequiredVars,
  waitIfSessionWillChangeInNblocks,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { waitForRewards } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let liqIdPromPool: BN;
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

  [testUser1] = setupUsers();

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqIdPromPool = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPromPool.toNumber(), 20),
    Assets.mintNative(testUser1)
  );
});

test("Check that rewards are generated and can be claimed on each session, then burn all tokens and rewards wont be available", async () => {
  const api = getApi();
  const { chainUri } = getEnvironmentRequiredVars();
  const mangata = await getMangataInstance(chainUri);

  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  );

  await waitForRewards(testUser1, liqIdPromPool);

  rewardsInfoBefore = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  await mangata.claimRewards(
    testUser1.keyRingPair,
    liqIdPromPool.toString(),
    defaultCurrencyValue
  );

  rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnGt(
    rewardsInfoBefore.rewardsAlreadyClaimed
  );

  const userBalanceBeforeBurning = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  const valueBurningTokens = userBalanceBeforeBurning.free.add(
    userBalanceBeforeBurning.reserved
  );

  await waitIfSessionWillChangeInNblocks(10);

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    token1,
    new BN(valueBurningTokens)
  );

  await claimRewardsAll(testUser1, liqIdPromPool);

  await waitIfSessionWillChangeInNblocks(10);

  rewardsInfoAfter = await getRewardsInfo(
    testUser1.keyRingPair.address,
    liqIdPromPool
  );

  expect(rewardsInfoAfter.rewardsNotYetClaimed).bnEqual(new BN(0));
  expect(rewardsInfoAfter.rewardsAlreadyClaimed).bnEqual(new BN(0));
});
