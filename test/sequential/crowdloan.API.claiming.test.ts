/*
 *
 * @group crowdloan
 *
 */
import { jest } from "@jest/globals";
import { ApiPromise } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN, hexToBn } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import {
  claimCrowdloanRewards,
  completeCrowdloanInitialization,
  initializeCrowdloanReward,
  setCrowdloanAllocation,
  sudoClaimCrowdloanRewards,
} from "../../utils/tx";
import { getBlockNumber, waitBlockNumber } from "../../utils/utils";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, waitNewBlock } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
let testUser5: User;
let testUser6: User;
let testUser7: User;
let testUser8: User;
let testUser9: User;
let leaseStartBlock: number;
let leaseEndingBlock: number;
let api: ApiPromise;
let sudo: User;
let crowdloanId: any;
const crowdloanRewardsAmount = new BN("1000000000000000000000000");
const nativeCurrencyId = GASP_ASSET_ID;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  api = getApi();
  sudo = getSudoUser();

  await setupApi();

  [testUser1, testUser2, testUser3, testUser4, testUser5] = setupUsers();
  [testUser6, testUser7, testUser8, testUser9] = setupUsers();

  testUser1.addAsset(nativeCurrencyId);
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(sudo),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Assets.mintNative(testUser5),
    Assets.mintNative(testUser6),
    Assets.mintNative(testUser7),
    Assets.mintNative(testUser8),
    Assets.mintNative(testUser9),
  );

  await setCrowdloanAllocation(crowdloanRewardsAmount.muln(8));

  await initializeCrowdloanReward(
    [
      testUser1,
      testUser2,
      testUser3,
      testUser4,
      testUser5,
      testUser6,
      testUser7,
      testUser8,
    ],
    crowdloanRewardsAmount,
  );

  leaseStartBlock = (await getBlockNumber()) + 10;
  leaseEndingBlock = (await getBlockNumber()) + 20;

  await completeCrowdloanInitialization(leaseStartBlock, leaseEndingBlock);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();
});

test("Users receive different rewards when they confirm them before, during and after crowdloan", async () => {
  const user1BalanceBeforeClaiming = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    GASP_ASSET_ID,
  );

  const user2BalanceBeforeClaiming = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    GASP_ASSET_ID,
  );

  const user3BalanceBeforeClaiming = await api.query.tokens.accounts(
    testUser3.keyRingPair.address,
    GASP_ASSET_ID,
  );

  await sudoClaimCrowdloanRewards(crowdloanId, testUser1);

  const user1BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    GASP_ASSET_ID,
  );

  await waitBlockNumber((leaseStartBlock + 5).toString(), 10);

  await sudoClaimCrowdloanRewards(crowdloanId, testUser2);

  const user2BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    GASP_ASSET_ID,
  );

  await waitBlockNumber(leaseEndingBlock.toString(), 10);
  await sudoClaimCrowdloanRewards(crowdloanId, testUser3);
  const user3BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser3.keyRingPair.address,
    GASP_ASSET_ID,
  );

  //if user claimed rewards before crowdloan all tokens would be frozen
  expect(new BN(user1BalanceAfterClaiming.frozen)).bnGt(
    crowdloanRewardsAmount.muln(0.78),
  );
  expect(
    new BN(user1BalanceAfterClaiming.free).sub(user1BalanceBeforeClaiming.free),
  ).bnEqual(crowdloanRewardsAmount);
  //if user claimed rewards in the second half of the crowdloan less than half tokens would be frozen
  expect(new BN(user2BalanceAfterClaiming.frozen)).bnLt(
    new BN(user1BalanceAfterClaiming.frozen).divn(2),
  );
  expect(new BN(user2BalanceAfterClaiming.frozen)).bnGt(BN_ZERO);
  expect(
    new BN(user2BalanceAfterClaiming.free).sub(user2BalanceBeforeClaiming.free),
  ).bnEqual(crowdloanRewardsAmount);
  //if user claimed rewards before crowdloan all tokens would be free
  expect(new BN(user3BalanceAfterClaiming.frozen)).bnEqual(BN_ZERO);
  expect(
    new BN(user3BalanceAfterClaiming.free).sub(user3BalanceBeforeClaiming.free),
  ).bnEqual(crowdloanRewardsAmount);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, api.tx.vesting.vest(GASP_ASSET_ID)),
    Sudo.sudoAs(testUser2, api.tx.vesting.vest(GASP_ASSET_ID)),
  );

  const user1FinalBalance = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    GASP_ASSET_ID,
  );
  const user2FinalBalance = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    GASP_ASSET_ID,
  );
  const user3FinalBalance = await api.query.tokens.accounts(
    testUser3.keyRingPair.address,
    GASP_ASSET_ID,
  );

  expect(new BN(user1FinalBalance.free)).bnEqual(
    new BN(user2FinalBalance.free),
  );
  expect(new BN(user3FinalBalance.free)).bnEqual(
    new BN(user1FinalBalance.free),
  );
});

test("A user can only change his reward-address with: crowdloan.updateRewardAddress AND user can claim some rewards if it provided some on the specified cl_id", async () => {
  await signTx(
    api,
    api.tx.crowdloan.updateRewardAddress(
      testUser9.keyRingPair.address,
      // @ts-ignore
      crowdloanId,
    ),
    testUser4.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitBlockNumber(leaseEndingBlock.toString(), 15);

  await claimCrowdloanRewards(crowdloanId, testUser4).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("NoAssociatedClaim");
  });

  const userBalanceBeforeClaiming = await api.query.tokens.accounts(
    testUser9.keyRingPair.address,
    GASP_ASSET_ID,
  );

  await claimCrowdloanRewards(crowdloanId, testUser9).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const userBalanceAfterClaiming = await api.query.tokens.accounts(
    testUser9.keyRingPair.address,
    GASP_ASSET_ID,
  );

  expect(
    new BN(userBalanceAfterClaiming.free).sub(userBalanceBeforeClaiming.free),
  ).bnGt(BN_ZERO);
});

describe("Test that a user can claim when", () => {
  test("CL1 is fully setup and no other CL is setup", async () => {
    await claimAndCheckUserReward(crowdloanId, testUser5);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation", async () => {
    await setCrowdloanAllocation(crowdloanRewardsAmount);

    await claimAndCheckUserReward(crowdloanId, testUser6);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation and RewardVec", async () => {
    await setCrowdloanAllocation(crowdloanRewardsAmount);
    await initializeCrowdloanReward([testUser4], crowdloanRewardsAmount);

    await claimAndCheckUserReward(crowdloanId, testUser7);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation and RewardVec and completeInitialization", async () => {
    await setCrowdloanAllocation(crowdloanRewardsAmount);
    await initializeCrowdloanReward([testUser4], crowdloanRewardsAmount);
    const leaseStartBlock = await getBlockNumber();
    const leaseEndingBlock = (await getBlockNumber()) + 5;
    await completeCrowdloanInitialization(leaseStartBlock, leaseEndingBlock);

    await claimAndCheckUserReward(crowdloanId, testUser8);
  });

  async function claimAndCheckUserReward(crowdloanId: any, user: User) {
    const userTokenAmountBefore = await api.query.tokens.accounts(
      user.keyRingPair.address,
      GASP_ASSET_ID,
    );

    await claimCrowdloanRewards(crowdloanId, user);

    await waitNewBlock();

    const userTokenAmountAfter = await api.query.tokens.accounts(
      user.keyRingPair.address,
      GASP_ASSET_ID,
    );

    const userTokenAmountDiff = userTokenAmountAfter!.free.sub(
      userTokenAmountBefore!.free,
    );

    const userAccountsPayable = JSON.parse(
      JSON.stringify(
        await api.query.crowdloan.accountsPayable(
          crowdloanId,
          user.keyRingPair.address,
        ),
      ),
    );

    const userClaimedReward = hexToBn(
      await userAccountsPayable.claimedReward.toString(),
    );

    expect(userTokenAmountDiff).bnGt(BN_ZERO);
    expect(userClaimedReward).bnEqual(crowdloanRewardsAmount);
  }
});
