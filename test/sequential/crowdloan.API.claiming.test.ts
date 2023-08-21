/*
 *
 * @group crowdloan
 *
 */
import { jest } from "@jest/globals";
import { ApiPromise, Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN, hexToBn } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import {
  getBlockNumber,
  getEnvironmentRequiredVars,
  waitBlockNumber,
} from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN_ZERO, signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
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
let keyring: Keyring;
let crowdloanId: any;
const millionNative = new BN("1000000000000000000000000");
const nativeCurrencyId = MGA_ASSET_ID;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  api = getApi();
  sudo = new User(keyring, sudoUserName);

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
    Assets.mintNative(testUser9)
  );

  await setCrowdloanAllocation(millionNative.muln(8));

  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.initializeRewardVec([
        [
          testUser1.keyRingPair.address,
          testUser1.keyRingPair.address,
          millionNative,
        ],
        [
          testUser2.keyRingPair.address,
          testUser2.keyRingPair.address,
          millionNative,
        ],
        [
          testUser3.keyRingPair.address,
          testUser3.keyRingPair.address,
          millionNative,
        ],
        [
          testUser4.keyRingPair.address,
          testUser4.keyRingPair.address,
          millionNative,
        ],
        [
          testUser5.keyRingPair.address,
          testUser5.keyRingPair.address,
          millionNative,
        ],
        [
          testUser6.keyRingPair.address,
          testUser6.keyRingPair.address,
          millionNative,
        ],
        [
          testUser7.keyRingPair.address,
          testUser7.keyRingPair.address,
          millionNative,
        ],
        [
          testUser8.keyRingPair.address,
          testUser8.keyRingPair.address,
          millionNative,
        ],
      ])
    )
  );

  leaseStartBlock = (await getBlockNumber()) + 10;
  leaseEndingBlock = (await getBlockNumber()) + 20;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();
});

test("Users receive different rewards when they confirm them before, during and after crowdloan", async () => {
  await sudoClaimRewards(crowdloanId, testUser1);

  const user1BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    MGA_ASSET_ID
  );

  await waitBlockNumber((leaseStartBlock + 5).toString(), 10);

  await sudoClaimRewards(crowdloanId, testUser2);

  const user2BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    MGA_ASSET_ID
  );

  await waitBlockNumber(leaseEndingBlock.toString(), 10);
  await sudoClaimRewards(crowdloanId, testUser3);
  const user3BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser3.keyRingPair.address,
    MGA_ASSET_ID
  );

  //if user claimed rewards before crowdloan all tokens would be frozen
  expect(new BN(user1BalanceAfterClaiming.frozen)).bnGt(
    millionNative.muln(0.78)
  );
  //if user claimed rewards in the second half of the crowdloan less than half tokens would be frozen
  expect(new BN(user2BalanceAfterClaiming.frozen)).bnLt(
    new BN(user1BalanceAfterClaiming.frozen).divn(2)
  );
  //if user claimed rewards before crowdloan all tokens would be free
  expect(new BN(user3BalanceAfterClaiming.frozen)).bnEqual(BN_ZERO);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(testUser1, api.tx.vesting.vest(MGA_ASSET_ID)),
    Sudo.sudoAs(testUser2, api.tx.vesting.vest(MGA_ASSET_ID))
  );

  const user1FinalBalance = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    MGA_ASSET_ID
  );
  const user2FinalBalance = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    MGA_ASSET_ID
  );
  const user3FinalBalance = await api.query.tokens.accounts(
    testUser3.keyRingPair.address,
    MGA_ASSET_ID
  );

  expect(new BN(user1FinalBalance.free)).bnEqual(
    new BN(user2FinalBalance.free)
  );
  expect(new BN(user3FinalBalance.free)).bnEqual(
    new BN(user1FinalBalance.free)
  );
});

test("A user can only change his reward-address with: crowdloan.updateRewardAddress AND user can claim some rewards if it provided some on the specified cl_id", async () => {
  await signTx(
    api,
    api.tx.crowdloan.updateRewardAddress(
      testUser9.keyRingPair.address,
      // @ts-ignore
      crowdloanId
    ),
    testUser4.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitBlockNumber(leaseEndingBlock.toString(), 15);

  await claimRewards(crowdloanId, testUser4).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("NoAssociatedClaim");
  });

  await claimRewards(crowdloanId, testUser9).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

describe("Test that a user can claim when", () => {
  test("CL1 is fully setup and no other CL is setup", async () => {
    await claimRewards(crowdloanId, testUser5);

    await checkUserReward(crowdloanId, testUser5);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation", async () => {
    await setCrowdloanAllocation(millionNative);

    await claimRewards(crowdloanId, testUser6);

    await checkUserReward(crowdloanId, testUser6);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation + RewardVec", async () => {
    await setCrowdloanAllocation(millionNative);
    await initializeReward(testUser4, millionNative);

    await claimRewards(crowdloanId, testUser7);

    await checkUserReward(crowdloanId, testUser7);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation + RewardVec + compleInitialization", async () => {
    await setCrowdloanAllocation(millionNative);
    await initializeReward(testUser4, millionNative);
    const leaseStartBlock = await getBlockNumber();
    const leaseEndingBlock = (await getBlockNumber()) + 5;
    await completeInitialization(leaseStartBlock, leaseEndingBlock);

    await claimRewards(crowdloanId, testUser8);

    await checkUserReward(crowdloanId, testUser8);
  });

  async function checkUserReward(crowdloanId: any, user: User) {
    const userAccountPayable = JSON.parse(
      JSON.stringify(
        await api.query.crowdloan.accountsPayable(
          crowdloanId,
          user.keyRingPair.address
        )
      )
    );

    const userClaimedReward = hexToBn(
      await userAccountPayable.claimedReward.toString()
    );

    expect(userClaimedReward).bnEqual(millionNative);
  }
});

async function setCrowdloanAllocation(crowdloanAllocationAmount: BN) {
  const setCrowdloanAllocation = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.setCrowdloanAllocation(crowdloanAllocationAmount)
    )
  );

  return setCrowdloanAllocation;
}

async function initializeReward(user1: User, Balance1: BN) {
  const initializeReward = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.initializeRewardVec([
        [user1.keyRingPair.address, user1.keyRingPair.address, Balance1],
      ])
    )
  );

  return initializeReward;
}

async function completeInitialization(
  leaseStartBlock: number,
  leaseEndingBlock: number
) {
  const completeInitialization = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.completeInitialization(
        leaseStartBlock,
        // @ts-ignore
        leaseEndingBlock
      )
    )
  );

  return completeInitialization;
}

async function claimRewards(crowdloanId: any, userId: User) {
  const claimRewards = await signTx(
    api,
    // @ts-ignore
    api.tx.crowdloan.claim(crowdloanId),
    userId.keyRingPair
  );
  const eventResponse = getEventResultFromMangataTx(claimRewards);
  return eventResponse;
}

async function sudoClaimRewards(crowdloanId: any, userId: User) {
  const claimRewards = await Sudo.batchAsSudoFinalized(
    // @ts-ignore
    Sudo.sudoAs(userId, api.tx.crowdloan.claim(crowdloanId))
  );
  const eventResponse = getEventResultFromMangataTx(claimRewards);
  return eventResponse;
}
