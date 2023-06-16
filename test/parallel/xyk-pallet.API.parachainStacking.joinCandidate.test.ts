/*
 *
 * @group xyk
 * @group parallel
 */

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

test("A user can schedule and execute bond more", async () => {
  const api = getApi();

  testUser1.addAsset(liqToken);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const userAmountBeforeJoining =
    testUser1.getAsset(liqToken)?.amountBefore.reserved!;

  await joinCandidate(testUser1.keyRingPair, liqToken, minStk.muln(2)).then(
    (result) => {
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    }
  );

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  const userAmountBeforeExecuting =
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

  const userAmountAfterExecuting =
    testUser1.getAsset(liqToken)?.amountAfter.reserved!;

  expect(userAmountBeforeJoining).bnEqual(BN_ZERO);
  expect(userAmountBeforeExecuting).bnEqual(minStk.muln(2));
  expect(userAmountAfterExecuting).bnEqual(minStk.muln(3));
});

test("A user can delegate more using liq token", async () => {
  const api = getApi();

  const testUser2 = new User(keyring);

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser2, minStk.muln(1000)),
    Assets.mintToken(liqToken, testUser2, minStk.muln(2))
  );

  testUser1.addAsset(liqToken);

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  await joinCandidate(testUser1.keyRingPair, liqToken, minStk.muln(2)).then(
    (result) => {
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    }
  );

  const collatorAmountAfterJoining = await getUserAmount(testUser1, liqToken);

  await delegate(
    testUser2.keyRingPair,
    liqToken,
    minStk.divn(2),
    "availablebalance"
  );

  await signTx(
    api,
    Staking.scheduleDelegatorBondMore(testUser1, minStk.divn(2)),
    testUser2.keyRingPair
  );

  const collatorAmountBeforeExecuting = await getUserAmount(
    testUser1,
    liqToken
  );

  await waitNewStakingRound();
  await waitNewStakingRound();

  await signTx(
    api,
    Staking.executeDelegationRequest(testUser2, testUser1),
    testUser2.keyRingPair
  );

  const collatorAmountAfterExecuting = await getUserAmount(testUser1, liqToken);

  expect(collatorAmountAfterJoining).bnEqual(minStk.muln(2));
  expect(collatorAmountBeforeExecuting).bnEqual(
    minStk.muln(2).add(minStk.divn(2))
  );
  expect(collatorAmountAfterExecuting).bnEqual(minStk.muln(3));
});

async function getUserAmount(user: User, tokenId: BN) {
  const api = getApi();
  let results: any;

  const poolInfo = JSON.parse(
    JSON.stringify(await api.query.parachainStaking.candidatePool())
  );

  for (let index = 0; index < poolInfo.length; index++) {
    if (
      poolInfo[index].owner === user.keyRingPair.address &&
      poolInfo[index].liquidityToken === tokenId.toNumber()
    ) {
      results = {
        amount: stringToBN(poolInfo[index].amount),
      };
    }
  }
  return results.amount;
}
