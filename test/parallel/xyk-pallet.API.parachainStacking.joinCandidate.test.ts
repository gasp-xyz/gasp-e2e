/*
 *
 * @group xyk
 * @group accuracy
 * @group rewardsV2Parallel
 */
import { getApi, initApi } from "../../utils/api";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId, joinCandidate } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Staking } from "../../utils/Staking";
import { Xyk } from "../../utils/xyk";
import { waitNewStakingRound } from "../../utils/utils";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;

let sudo: User;

let keyring: Keyring;
let tokenId: BN;
let liqToken: BN;
let minStk: BN;

//creating pool

const { sudo: sudoUserName } = getEnvironmentRequiredVars();

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  minStk = new BN(
    (await getApi()).consts.parachainStaking.minCandidateStk.toString()
  );

  [tokenId] = await Assets.setupUserWithCurrencies(
    testUser,
    [minStk.muln(1000), minStk.muln(1000)],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser, minStk.muln(1000)),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(MGA_ASSET_ID, minStk.muln(3), tokenId, minStk.muln(3))
    )
  );

  liqToken = await getLiquidityAssetId(MGA_ASSET_ID, tokenId);

  await Sudo.asSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken))
  );
});

beforeEach(async () => {
  testUser1 = new User(keyring);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, minStk.muln(1000)),
    Assets.mintToken(tokenId, testUser1, minStk.muln(1000))
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, tokenId, minStk.muln(5), minStk.muln(6))
    )
  );
});

test("A User with free tokens can join as collator", async () => {
  const result = await joinCandidate(
    testUser1.keyRingPair,
    liqToken,
    minStk.muln(2)
  );
  expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const isUserInCandidate = await Staking.isUserInCandidateList(
    testUser1.keyRingPair.address
  );
  expect(isUserInCandidate).toBeTruthy();
});

test("A user can schedule bond more", async () => {
  const api = getApi();

  testUser1.addAsset(liqToken);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const userCurrencyBeforeJoining =
    testUser1.getAsset(liqToken)?.amountBefore.reserved!;

  await joinCandidate(testUser1.keyRingPair, liqToken, minStk.muln(2)).then(
    (result) => {
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    }
  );

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const userCurrencyBeforeExecuting =
    testUser1.getAsset(liqToken)?.amountBefore.reserved!;

  await signTx(
    api,
    Staking.scheduleCandidateBondMore(minStk),
    testUser1.keyRingPair
  );

  await waitNewStakingRound();
  await waitNewStakingRound();

  await signTx(
    api,
    Staking.executeBondRequest(testUser1),
    testUser1.keyRingPair
  );

  await testUser1.refreshAmounts(AssetWallet.AFTER);

  const userCurrencyAfterExecuting =
    testUser1.getAsset(liqToken)?.amountAfter.reserved!;

  expect(userCurrencyBeforeJoining).bnEqual(BN_ZERO);
  expect(userCurrencyBeforeExecuting).bnEqual(minStk.muln(2));
  expect(userCurrencyAfterExecuting).bnEqual(minStk.muln(3));
});
