/*
 *
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
import { BN_ZERO, MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import {
  getEventErrorFromSudo,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import {
  ExtrinsicResult,
  waitSudoOperationFail,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { RegistryError } from "@polkadot/types/types";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let testUser2: User;
let testUser3: User;
let testUser4: User;
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

  [testUser1, testUser2, testUser3, testUser4] = setupUsers();

  testUser1.addAsset(nativeCurrencyId);
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(sudo),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4)
  );
});

test("Only sudo can crowdloan.setCrowdloanAllocation(crowdloanAllocationAmount)", async () => {
  const userSetCrowdloanAllocation = await signTx(
    api,
    api.tx.crowdloan.setCrowdloanAllocation(millionNative),
    testUser1.keyRingPair
  );

  const eventResponse = getEventResultFromMangataTx(userSetCrowdloanAllocation);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual("UnknownError");

  const sudoSetCrowdloanAllocation = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(api.tx.crowdloan.setCrowdloanAllocation(millionNative))
  );

  await waitSudoOperationSuccess(sudoSetCrowdloanAllocation);
});

test("Only sudo can crowdloan initializeRewardVec(rewards)", async () => {
  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(api.tx.crowdloan.setCrowdloanAllocation(millionNative))
  );

  const userInitializeRewardVec = await signTx(
    api,
    api.tx.crowdloan.initializeRewardVec([
      [
        testUser1.keyRingPair.address,
        testUser1.keyRingPair.address,
        millionNative,
      ],
    ]),
    testUser1.keyRingPair
  );

  const eventResponse = getEventResultFromMangataTx(userInitializeRewardVec);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual("UnknownError");

  const sudoInitializeRewardVec = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.initializeRewardVec([
        [
          testUser1.keyRingPair.address,
          testUser1.keyRingPair.address,
          millionNative,
        ],
      ])
    )
  );

  await waitSudoOperationSuccess(sudoInitializeRewardVec);
});

test("Only sudo can crowdloan.completeInitialization(leaseEndingBlock)", async () => {
  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(api.tx.crowdloan.setCrowdloanAllocation(millionNative))
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.initializeRewardVec([
        [
          testUser1.keyRingPair.address,
          testUser1.keyRingPair.address,
          millionNative,
        ],
      ])
    )
  );

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 5;

  const userCompleteInitialization = await signTx(
    api,
    api.tx.crowdloan.completeInitialization(
      leaseStartBlock,
      // @ts-ignore
      leaseEndingBlock
    ),
    testUser1.keyRingPair
  );

  const eventResponse = getEventResultFromMangataTx(userCompleteInitialization);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual("UnknownError");

  const sudoCompleteInitialization = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.completeInitialization(
        leaseStartBlock,
        // @ts-ignore
        leaseEndingBlock
      )
    )
  );

  await waitSudoOperationSuccess(sudoCompleteInitialization);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("A user can only change his reward-address with: crowdloan.updateRewardAddress(newRewardAccount)", async () => {
  await setCrowdloanAllocation(millionNative);

  await initializeReward(testUser1, millionNative);

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 5;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await signTx(
    api,
    api.tx.crowdloan.updateRewardAddress(
      testUser2.keyRingPair.address,
      // @ts-ignore
      crowdloanId
    ),
    testUser1.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitBlockNumber(leaseEndingBlock.toString(), 15);

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("NoAssociatedClaim");
  });

  await claimRewards(crowdloanId, testUser2).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("A reward needs to be fully setup with: setCrowdloanAllocation + initializeRewardVec + completeInitialization", async () => {
  await setCrowdloanAllocation(millionNative);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("RewardVecNotFullyInitializedYet");
  });

  await initializeReward(testUser1, millionNative);

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("RewardVecNotFullyInitializedYet");
  });

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 10;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("CL needs to be setup in order", async () => {
  let leaseStartBlock: number;
  let leaseEndingBlock: number;
  let initializationRewards: MangataGenericEvent[];
  let initializationCrowdloan: MangataGenericEvent[];
  let BootstrapError: RegistryError;

  initializationRewards = await initializeReward(testUser1, millionNative);

  BootstrapError = await getEventErrorFromSudo(
    initializationRewards.filter(
      (extrinsicResult) => extrinsicResult.method === "Sudid"
    )
  );

  if ((BootstrapError.method = "BatchBeyondFundPot")) {
    await waitSudoOperationFail(initializationRewards, "BatchBeyondFundPot");
  } else {
    await waitSudoOperationFail(
      initializationRewards,
      "RewardVecAlreadyInitialized"
    );
  }

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 10;

  initializationCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  BootstrapError = await getEventErrorFromSudo(
    initializationCrowdloan.filter(
      (extrinsicResult) => extrinsicResult.method === "Sudid"
    )
  );

  if ((BootstrapError.method = "RewardsDoNotMatchFund")) {
    await waitSudoOperationFail(
      initializationCrowdloan,
      "RewardsDoNotMatchFund"
    );
  } else {
    await waitSudoOperationFail(
      initializationCrowdloan,
      "RewardVecAlreadyInitialized"
    );
  }

  await setCrowdloanAllocation(millionNative);

  initializationCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  await waitSudoOperationFail(initializationCrowdloan, "RewardsDoNotMatchFund");

  initializationRewards = await initializeReward(testUser1, millionNative);

  await waitSudoOperationSuccess(initializationRewards);

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 5;

  initializationCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  await waitSudoOperationSuccess(initializationCrowdloan);
});

test("A user can claim some rewards if it provided some on the specified cl_id", async () => {
  let leaseStartBlock: number;
  let leaseEndingBlock: number;

  await setCrowdloanAllocation(millionNative);

  const firstCrowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await initializeReward(testUser1, millionNative);

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 5;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  await waitBlockNumber(leaseEndingBlock.toString(), 10);

  await setCrowdloanAllocation(millionNative);

  const secondCrowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await initializeReward(testUser2, millionNative);

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 5;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  await claimRewards(secondCrowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("NoAssociatedClaim");
  });

  await claimRewards(firstCrowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("Total contributors returns the number of contributors per crowdloan AND validation of contributions is done when Initializing the cl rewards", async () => {
  let numberContributors: any;

  await setCrowdloanAllocation(millionNative);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  numberContributors = (
    await api.query.crowdloan.totalContributors(crowdloanId)
  ).toHuman();

  expect(numberContributors!.toString()).toEqual("0");

  await initializeReward(testUser1, millionNative);

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 5;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  numberContributors = (
    await api.query.crowdloan.totalContributors(crowdloanId)
  ).toHuman();

  expect(numberContributors!.toString()).toEqual("1");
});

test("Users receive different rewards when they confirm them before, during and after crowdloan", async () => {
  await setCrowdloanAllocation(millionNative.muln(3));

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

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
      ])
    )
  );
  const leaseStartBlock = (await getBlockNumber()) + 10;
  const leaseEndingBlock = (await getBlockNumber()) + 20;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  await claimRewards(crowdloanId, testUser1);

  const user1BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    MGA_ASSET_ID
  );

  await waitBlockNumber((leaseStartBlock + 5).toString(), 10);

  await claimRewards(crowdloanId, testUser2);

  const user2BalanceAfterClaiming = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    MGA_ASSET_ID
  );

  await waitBlockNumber(leaseEndingBlock.toString(), 10);
  await claimRewards(crowdloanId, testUser3);
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

  await claimRewards(crowdloanId, testUser1);
  await claimRewards(crowdloanId, testUser2);
});

describe("Test that a user can claim when", () => {
  beforeAll(async () => {
    await setCrowdloanAllocation(millionNative.muln(4));
    crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

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
        ])
      )
    );
    const leaseStartBlock = (await getBlockNumber()) + 2;
    const leaseEndingBlock = (await getBlockNumber()) + 5;
    await completeInitialization(leaseStartBlock, leaseEndingBlock);
    await waitBlockNumber(leaseEndingBlock.toString(), 10);
  });

  test("CL1 is fully setup and no other CL is setup", async () => {
    await claimRewards(crowdloanId, testUser1);

    await checkUserReward(crowdloanId, testUser1);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation", async () => {
    await setCrowdloanAllocation(millionNative);

    await claimRewards(crowdloanId, testUser2);

    await checkUserReward(crowdloanId, testUser2);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation + RewardVec", async () => {
    await setCrowdloanAllocation(millionNative);
    await initializeReward(testUser1, millionNative);

    await claimRewards(crowdloanId, testUser3);

    await checkUserReward(crowdloanId, testUser3);
  });

  test("CL1 is fully setup and CL2 setup the setCrowdloanAllocation + RewardVec + compleInitialization", async () => {
    await setCrowdloanAllocation(millionNative);
    await initializeReward(testUser1, millionNative);
    const leaseStartBlock = await getBlockNumber();
    const leaseEndingBlock = (await getBlockNumber()) + 5;
    await completeInitialization(leaseStartBlock, leaseEndingBlock);

    await claimRewards(crowdloanId, testUser4);

    await checkUserReward(crowdloanId, testUser4);
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
