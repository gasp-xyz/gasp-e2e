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
import {
  burnLiquidity,
  claimRewards,
  deactivateLiquidity,
  getLiquidityAssetId,
} from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  getMultiPurposeLiquidityStatus,
} from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { BN } from "@polkadot/util";
import { BN_BILLION, BN_ZERO } from "@mangata-finance/sdk";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ProofOfStake } from "../../utils/ProofOfStake";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let token2: BN = BN_ZERO;
let token3: BN = BN_ZERO;
let liqId: BN = BN_ZERO;
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

  [token2, token3] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token3, testUser, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
        token3,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );
  liqId = await getLiquidityAssetId(token2, token3);
  [testUser1] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Assets.mintToken(liqId, testUser1, BN_BILLION),
    Assets.mintNative(testUser1),
    Assets.mintNative(sudo),
    Sudo.sudoAs(testUser1, ProofOfStake.activateLiquidity(liqId, BN_BILLION)),
  );
  testUser1.addAsset(MGA_ASSET_ID);
  testUser1.addAsset(liqId);
  await waitForRewards(testUser1, liqId);
  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 0));
  //Now we have 2 pools that generated soem rewards and are now de-promoted.
});

test("GIVEN a disabled pool the user can still interact with it: Burn, deactivate Liq", async () => {
  const testTokenId = liqId;
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  const mplBef = await getMultiPurposeLiquidityStatus(
    testUser1.keyRingPair.address,
    testTokenId,
  );
  expect(mplBef.activatedUnstakedReserves).bnEqual(BN_BILLION);

  await burnLiquidity(
    testUser1.keyRingPair,
    token2,
    token3,
    BN_BILLION.divn(2),
  ).then((result) => {
    const event = getEventResultFromMangataTx(result);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await testUser1.refreshAmounts(AssetWallet.AFTER);
  expect(testUser1.getAsset(testTokenId)!.amountAfter.reserved!).bnEqual(
    BN_BILLION.divn(2),
  );
  expect(testUser1.getAsset(testTokenId)!.amountBefore.reserved!).bnEqual(
    BN_BILLION,
  );
  const mpl = await getMultiPurposeLiquidityStatus(
    testUser1.keyRingPair.address,
    testTokenId,
  );
  expect(mpl.activatedUnstakedReserves).bnEqual(BN_BILLION.divn(2));

  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  await deactivateLiquidity(
    testUser1.keyRingPair,
    testTokenId,
    BN_BILLION.divn(2),
  ).then((result) => {
    const event = getEventResultFromMangataTx(result);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  expect(testUser1.getAsset(testTokenId)!.amountAfter.reserved!).bnEqual(
    BN_ZERO,
  );
  expect(testUser1.getAsset(testTokenId)!.amountAfter.free!).bnEqual(
    BN_BILLION.divn(2),
  );

  const mplAfterDeac = await getMultiPurposeLiquidityStatus(
    testUser1.keyRingPair.address,
    testTokenId,
  );
  expect(mplAfterDeac.activatedUnstakedReserves).bnEqual(BN_ZERO);

  await claimRewards(testUser1, testTokenId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});
