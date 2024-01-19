/*
 *
 * @group sdk
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { ProofOfStake } from "../../utils/ProofOfStake";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitForRewards } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
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

  const users = setupUsers();
  testUser = users[5];

  await setupApi();

  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(sudo, Assets.DEFAULT_AMOUNT.muln(10)),
    Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT.muln(10)),
    Assets.mintToken(token1, sudo, Assets.DEFAULT_AMOUNT),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      sudo,
      Xyk.createPool(
        MGA_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.promotePool(liqId.toNumber(), 20),
    Assets.mintToken(liqId, testUser, Assets.DEFAULT_AMOUNT),
  );

  testUser.addAsset(liqId);
  testUser.addAsset(MGA_ASSET_ID);
  testUser.addAsset(token1);
});

test.skip("TODO Activate some Liquidity using SDK THEN claim rewards THEN deactivate Liquidity", async () => {
  await testUser.refreshAmounts(AssetWallet.BEFORE);

  // this options must be changed to SDK function activateLiquidityForNativeRewards
  await signTx(
    getApi(),
    await ProofOfStake.activateLiquidityForNativeRewards(
      liqId,
      Assets.DEFAULT_AMOUNT,
    ),
    testUser.keyRingPair,
  ).then((events) => {
    expect(getEventResultFromMangataTx(events).state).toBe(
      ExtrinsicResult.ExtrinsicSuccess,
    );
  });

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const reservedTokens = testUser.getAsset(liqId)?.amountAfter.reserved!;

  expect(reservedTokens).bnEqual(Assets.DEFAULT_AMOUNT);

  await waitForRewards(testUser, liqId);

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await signTx(
    getApi(),
    await ProofOfStake.claimNativeRewards(liqId),
    testUser.keyRingPair,
  ).then((events) => {
    expect(getEventResultFromMangataTx(events).state).toBe(
      ExtrinsicResult.ExtrinsicSuccess,
    );
  });

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const claimedRewards = testUser
    .getAsset(MGA_ASSET_ID)
    ?.amountAfter.free!.sub(
      testUser.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
    );

  expect(claimedRewards).bnGt(BN_ZERO);

  await testUser.refreshAmounts(AssetWallet.BEFORE);

  await signTx(
    getApi(),
    await ProofOfStake.deactivateLiquidityForNativeRewards(
      liqId,
      Assets.DEFAULT_AMOUNT,
    ),
    testUser.keyRingPair,
  ).then((events) => {
    expect(getEventResultFromMangataTx(events).state).toBe(
      ExtrinsicResult.ExtrinsicSuccess,
    );
  });

  await testUser.refreshAmounts(AssetWallet.AFTER);

  const amountDifference = testUser
    .getAsset(liqId)!
    .amountBefore.reserved.sub(testUser.getAsset(liqId)!.amountAfter.reserved);

  expect(amountDifference).bnEqual(Assets.DEFAULT_AMOUNT);
});
