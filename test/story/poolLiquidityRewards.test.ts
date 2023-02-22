/*
 *
 * @group rewardsv2
 */

import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import {
  mintLiquidity,
  activateLiquidity,
  getLiquidityAssetId,
  burnLiquidity,
} from "../../utils/tx";
import { setupApi, setupUsers } from "../../utils/setup";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { MGA_ASSET_ID } from "../../utils/Constants";

const defaultCurrencyValue = new BN(10000000);
const assetAmount = new BN("1000000000000000");

let testUser1: User;
let sudo: User;

let keyring: Keyring;
let secondCurrency: BN;
let liqId: BN;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
});

beforeEach(async () => {
  [testUser1] = setupUsers();

  secondCurrency = await Assets.issueAssetToUser(
    sudo,
    defaultCurrencyValue,
    sudo,
    true
  );

  await setupApi();

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(secondCurrency, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        secondCurrency,
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    )
  );

  liqId = await getLiquidityAssetId(MGA_ASSET_ID, secondCurrency);
});

test("Given a user with Liquidity on non promoted pool When tries to activate Then extrinsic fail", async () => {
  await mintLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    secondCurrency,
    assetAmount
  );

  await activateLiquidity(testUser1.keyRingPair, liqId, assetAmount).then(
    (result) => {
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(result.data).toEqual("NotAPromotedPool");
    }
  );
});

test("Given a user with Liquidity activated When tries to deactivate Then the user gets all tokens burn and rewards amount are readable in RPC THEN the user can claim them", async () => {
  const { chainUri } = getEnvironmentRequiredVars();
  const mangata = await getMangataInstance(chainUri);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, secondCurrency, assetAmount)
    )
  );

  await waitForRewards(testUser1, liqId);

  const liqBalance = await mangata.getTokenBalance(
    liqId.toString(),
    testUser1.keyRingPair.address
  );

  const availableRewardsBefore = await mangata.calculateRewardsAmount(
    testUser1.keyRingPair.address,
    liqId.toString()
  );

  await burnLiquidity(
    testUser1.keyRingPair,
    MGA_ASSET_ID,
    secondCurrency,
    new BN(liqBalance.free.toString())
  );

  await mangata.claimRewards(
    testUser1.keyRingPair,
    liqId.toString(),
    availableRewardsBefore
  );

  await waitForRewards(testUser1, liqId);

  const availableRewardsAfter = await mangata.calculateRewardsAmount(
    testUser1.keyRingPair.address,
    liqId.toString()
  );

  expect(availableRewardsAfter).bnGt(availableRewardsBefore);
});
