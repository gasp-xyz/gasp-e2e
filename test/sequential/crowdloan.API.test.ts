/*
 * @group crowdloan
 *
 */
import { jest } from "@jest/globals";
import { ApiPromise, Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { getBlockNumber, getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
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
const crowdloanRewardsAmount = new BN("1000000000000000000000000");
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

describe("Only sudo can", () => {
  test("crowdloan.setCrowdloanAllocation(crowdloanAllocationAmount)", async () => {
    const userSetCrowdloanAllocation = await signTx(
      api,
      api.tx.crowdloan.setCrowdloanAllocation(crowdloanRewardsAmount),
      testUser1.keyRingPair
    );

    const eventResponse = getEventResultFromMangataTx(
      userSetCrowdloanAllocation
    );

    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("UnknownError");

    const sudoSetCrowdloanAllocation = await Sudo.batchAsSudoFinalized(
      Sudo.sudo(api.tx.crowdloan.setCrowdloanAllocation(crowdloanRewardsAmount))
    );

    await waitSudoOperationSuccess(sudoSetCrowdloanAllocation);
  });

  test("crowdloan.initializeRewardVec(rewards)", async () => {
    const userInitializeRewardVec = await signTx(
      api,
      api.tx.crowdloan.initializeRewardVec([
        [
          testUser1.keyRingPair.address,
          testUser1.keyRingPair.address,
          crowdloanRewardsAmount,
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
            crowdloanRewardsAmount,
          ],
        ])
      )
    );

    await waitSudoOperationSuccess(sudoInitializeRewardVec);
  });

  test("crowdloan.completeInitialization(leaseEndingBlock)", async () => {
    let leaseStartBlock: number;
    let leaseEndingBlock: number;

    leaseStartBlock = (await getBlockNumber()) + 2;
    leaseEndingBlock = (await getBlockNumber()) + 5;

    const userCompleteInitialization = await signTx(
      api,
      api.tx.crowdloan.completeInitialization(
        leaseStartBlock,
        // @ts-ignore
        leaseEndingBlock
      ),
      testUser1.keyRingPair
    );

    const eventResponse = getEventResultFromMangataTx(
      userCompleteInitialization
    );

    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("UnknownError");

    leaseStartBlock = (await getBlockNumber()) + 2;
    leaseEndingBlock = (await getBlockNumber()) + 5;

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
});

test("A reward needs to be fully setup with: setCrowdloanAllocation + initializeRewardVec + completeInitialization", async () => {
  await setCrowdloanAllocation(crowdloanRewardsAmount);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("RewardVecNotFullyInitializedYet");
  });

  await initializeReward(testUser1, crowdloanRewardsAmount);

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

  initializationRewards = await initializeReward(
    testUser1,
    crowdloanRewardsAmount
  );

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

  await setCrowdloanAllocation(crowdloanRewardsAmount);

  initializationCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  await waitSudoOperationFail(initializationCrowdloan, "RewardsDoNotMatchFund");

  initializationRewards = await initializeReward(
    testUser1,
    crowdloanRewardsAmount
  );

  await waitSudoOperationSuccess(initializationRewards);

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 5;

  initializationCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  await waitSudoOperationSuccess(initializationCrowdloan);
});

test("Total contributors returns the number of contributors per crowdloan AND validation of contributions is done when Initializing the cl rewards", async () => {
  let numberContributors: any;

  await setCrowdloanAllocation(crowdloanRewardsAmount);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  numberContributors = (
    await api.query.crowdloan.totalContributors(crowdloanId)
  ).toHuman();

  expect(numberContributors!.toString()).toEqual("0");

  await initializeReward(testUser1, crowdloanRewardsAmount);

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 5;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  numberContributors = (
    await api.query.crowdloan.totalContributors(crowdloanId)
  ).toHuman();

  expect(numberContributors!.toString()).toEqual("1");
});

async function setCrowdloanAllocation(crowdloanAllocationAmount: BN) {
  const setCrowdloanAllocation = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.setCrowdloanAllocation(crowdloanAllocationAmount)
    )
  );

  return setCrowdloanAllocation;
}

async function initializeReward(user: User, crowdloanRewardsAmount: BN) {
  const initializeReward = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.initializeRewardVec([
        [
          user.keyRingPair.address,
          user.keyRingPair.address,
          crowdloanRewardsAmount,
        ],
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
