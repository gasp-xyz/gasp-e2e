/*
 *
 * @group xyk
 * @group liquidity
 * @group rewardsV2Parallel
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi, mangata } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { activateLiquidity, getLiquidityAssetId } from "../../utils/tx";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { waitForRewards } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let testUser11: User;
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

  [testUser1, testUser2, testUser3, testUser11] = setupUsers();

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
    Assets.mintToken(token1, testUser11, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token2, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token3, testUser3, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser11),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
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
      testUser2,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token3,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqIdPool1 = await getLiquidityAssetId(MGA_ASSET_ID, token1);
  liqIdPool2 = await getLiquidityAssetId(MGA_ASSET_ID, token2);
  liqIdPool3 = await getLiquidityAssetId(MGA_ASSET_ID, token3);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser11,
      Xyk.mintLiquidity(
        MGA_ASSET_ID,
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
        Assets.DEFAULT_AMOUNT.muln(2),
      ),
    ),
    Assets.promotePool(liqIdPool1.toNumber(), 20),
    Assets.mintNative(testUser1),
  );
});

test("GIVEN a promoted pool WHEN more pools gets activated THEN shares are decreased and equally divided among all the activated pools", async () => {
  await activateLiquidity(
    testUser1.keyRingPair,
    liqIdPool1,
    Assets.DEFAULT_AMOUNT.divn(2),
  );
  await waitForRewards(testUser1, liqIdPool1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqIdPool2.toNumber(), 20),
    Assets.promotePool(liqIdPool3.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Xyk.deactivateLiquidity(liqIdPool1, Assets.DEFAULT_AMOUNT.divn(2)),
    ),
    Sudo.sudoAs(
      testUser2,
      Xyk.activateLiquidity(liqIdPool2, Assets.DEFAULT_AMOUNT.divn(2)),
    ),
    Sudo.sudoAs(
      testUser3,
      Xyk.activateLiquidity(liqIdPool3, Assets.DEFAULT_AMOUNT.divn(2)),
    ),
    Sudo.sudoAs(
      testUser11,
      Xyk.activateLiquidity(liqIdPool1, Assets.DEFAULT_AMOUNT.divn(2)),
    ),
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPool1)),
  );

  await waitForRewards(testUser11, liqIdPool1);
  await waitForRewards(testUser2, liqIdPool2);
  await waitForRewards(testUser3, liqIdPool3);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser11, Xyk.claimRewardsAll(liqIdPool1)),
    Sudo.sudoAs(testUser1, Xyk.claimRewardsAll(liqIdPool1)),
    Sudo.sudoAs(testUser2, Xyk.claimRewardsAll(liqIdPool2)),
    Sudo.sudoAs(testUser3, Xyk.claimRewardsAll(liqIdPool3)),
  );

  await waitForRewards(testUser11, liqIdPool1);

  const testUser1Rewards = await mangata?.rpc.calculateRewardsAmount({
    address: testUser1.keyRingPair.address,
    liquidityTokenId: liqIdPool1.toString(),
  })!;
  const testUser11Rewards = await mangata?.rpc.calculateRewardsAmount({
    address: testUser11.keyRingPair.address,
    liquidityTokenId: liqIdPool1.toString(),
  })!;
  const testUser2Rewards = await mangata?.rpc.calculateRewardsAmount({
    address: testUser2.keyRingPair.address,
    liquidityTokenId: liqIdPool2.toString(),
  })!;
  const testUser3Rewards = await mangata?.rpc.calculateRewardsAmount({
    address: testUser3.keyRingPair.address,
    liquidityTokenId: liqIdPool3.toString(),
  })!;
  expect(testUser1Rewards).bnEqual(BN_ZERO);
  expect(testUser11Rewards).bnGt(BN_ZERO);
  expect(testUser11Rewards).bnEqual(testUser2Rewards);
  expect(testUser2Rewards).bnEqual(testUser3Rewards);
});
