/*
 *
 * @group xyk
 * @group experimentalStaking
 */
import { jest } from "@jest/globals";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { ExtrinsicResult } from "../../utils/eventListeners";
import {
  getEnvironmentRequiredVars,
  stringToBN,
  waitNewStakingRound,
} from "../../utils/utils";
import { Sudo } from "../../utils/sudo";
import { Staking } from "../../utils/Staking";
import { delegate, getLiquidityAssetId, joinCandidate } from "../../utils/tx";
import { AssetWallet, User } from "../../utils/User";
import { Xyk } from "../../utils/xyk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

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
    (await getApi()).consts.parachainStaking.minCandidateStk.toString(),
  );

  [tokenId] = await Assets.setupUserWithCurrencies(
    testUser,
    [minStk.muln(1000), minStk.muln(1000)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser, minStk.muln(1000)),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(MGA_ASSET_ID, minStk.muln(3), tokenId, minStk.muln(3)),
    ),
  );

  liqToken = await getLiquidityAssetId(MGA_ASSET_ID, tokenId);

  await Sudo.asSudoFinalized(
    Sudo.sudo(Staking.addStakingLiquidityToken(liqToken)),
  );
});

beforeEach(async () => {
  testUser1 = new User(keyring);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, minStk.muln(1000)),
    Assets.mintToken(tokenId, testUser1, minStk.muln(1000)),
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.mintLiquidity(MGA_ASSET_ID, tokenId, minStk.muln(5), minStk.muln(6)),
    ),
  );
});

test("A user can delegate more using liq token", async () => {
  const api = getApi();

  const testUser2 = new User(keyring);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser2, minStk.muln(1000)),
    Assets.mintToken(liqToken, testUser2, minStk.muln(2)),
  );

  testUser1.addAsset(liqToken);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await joinCandidate(testUser1.keyRingPair, liqToken, minStk.muln(2)).then(
    (result) => {
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  const candidateStateAfterJoining = await getCandidateState(testUser1);

  await delegate(
    testUser2.keyRingPair,
    liqToken,
    minStk.divn(4),
    "AvailableBalance",
  ).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await signTx(
    api,
    Staking.scheduleDelegatorBondMore(testUser1, minStk.divn(4)),
    testUser2.keyRingPair,
  ).then((value) => {
    const event = getEventResultFromMangataTx(value);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const candidateStateBeforeExecuting = await getCandidateState(testUser1);

  await waitNewStakingRound();
  await waitNewStakingRound();

  await signTx(
    api,
    Staking.executeDelegationRequest(testUser2, testUser1),
    testUser2.keyRingPair,
  ).then((value) => {
    const event = getEventResultFromMangataTx(value);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const candidateStateAfterExecuting = await getCandidateState(testUser1);

  await checkCandidateInfo(
    candidateStateAfterJoining,
    minStk.muln(2),
    minStk.muln(2),
    minStk.muln(2),
  );
  await checkCandidateInfo(
    candidateStateBeforeExecuting,
    minStk.muln(2),
    minStk.muln(2).add(minStk.divn(4)),
    minStk.muln(2).add(minStk.divn(4)),
  );
  await checkCandidateInfo(
    candidateStateAfterExecuting,
    minStk.muln(2),
    minStk.muln(2).add(minStk.divn(2)),
    minStk.muln(2).add(minStk.divn(2)),
  );
});

test("A User with free tokens can join as collator", async () => {
  const result = await joinCandidate(
    testUser1.keyRingPair,
    liqToken,
    minStk.muln(2),
  );
  expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const isUserInCandidate = await Staking.isUserInCandidateList(
    testUser1.keyRingPair.address,
  );
  expect(isUserInCandidate).toBeTruthy();
});

test("A user can schedule and execute bond more", async () => {
  const api = getApi();

  testUser1.addAsset(liqToken);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const candidateStateBeforeJoining =
    testUser1.getAsset(liqToken)?.amountBefore.reserved!;

  await joinCandidate(testUser1.keyRingPair, liqToken, minStk.muln(2)).then(
    (result) => {
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    },
  );

  const candidateStateBeforeExecuting = await getCandidateState(testUser1);

  await signTx(
    api,
    Staking.scheduleCandidateBondMore(minStk),
    testUser1.keyRingPair,
  ).then((value) => {
    const event = getEventResultFromMangataTx(value);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitNewStakingRound();
  await waitNewStakingRound();

  await signTx(
    api,
    Staking.executeBondRequest(testUser1),
    testUser1.keyRingPair,
  ).then((value) => {
    const event = getEventResultFromMangataTx(value);
    expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const candidateStateAfterExecuting = await getCandidateState(testUser1);

  expect(candidateStateBeforeJoining).bnEqual(BN_ZERO);
  await checkCandidateInfo(
    candidateStateBeforeExecuting,
    minStk.muln(2),
    minStk.muln(2),
    minStk.muln(2),
  );
  await checkCandidateInfo(
    candidateStateAfterExecuting,
    minStk.muln(3),
    minStk.muln(3),
    minStk.muln(3),
  );
});

async function getCandidateState(user: User) {
  const api = getApi();

  const candidateState = await api.query.parachainStaking.candidateState(
    user.keyRingPair.address,
  );

  return {
    bond: stringToBN(candidateState.value.bond.toString()),
    totalCounted: stringToBN(candidateState.value.totalCounted.toString()),
    totalBacking: stringToBN(candidateState.value.totalBacking.toString()),
  };
}

async function checkCandidateInfo(
  candidateState: { bond: BN; totalCounted: BN; totalBacking: BN },
  bondAmount: BN,
  totalCountedAmount: BN,
  totalBackingAmount: BN,
) {
  expect(candidateState.bond).bnEqual(bondAmount);
  expect(candidateState.totalCounted).bnEqual(totalCountedAmount);
  expect(candidateState.totalBacking).bnEqual(totalBackingAmount);
}
