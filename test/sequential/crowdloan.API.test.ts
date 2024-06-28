/*
 * @group crowdloan
 *
 */
import { jest } from "@jest/globals";
import { ApiPromise, Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { BN } from "@polkadot/util";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { getBlockNumber, isBadOriginError } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { MangataGenericEvent, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  ExtrinsicResult,
  waitSudoOperationFail,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import {
  claimCrowdloanRewards,
  completeCrowdloanInitialization,
  initializeCrowdloanReward,
  setCrowdloanAllocation,
} from "../../utils/tx";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
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
  keyring = new Keyring({ type: "ethereum" });

  api = getApi();
  sudo = getSudoUser();
  await setupApi();

  [testUser1] = setupUsers();

  keyring.addPair(sudo.keyRingPair);

  testUser1.addAsset(nativeCurrencyId);
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser1));
});

describe("Only sudo can", () => {
  test("crowdloan.setCrowdloanAllocation(crowdloanAllocationAmount)", async () => {
    const setCrowdLoanAllocationEvents = await signTx(
      api,
      api.tx.crowdloan.setCrowdloanAllocation(crowdloanRewardsAmount),
      testUser1.keyRingPair,
    );

    const eventResponse = getEventResultFromMangataTx(
      setCrowdLoanAllocationEvents,
    );

    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    const isBadOrigin = isBadOriginError(setCrowdLoanAllocationEvents);
    expect(isBadOrigin).toEqual(true);
    const sudoSetCrowdloanAllocationEvents = await Sudo.batchAsSudoFinalized(
      Sudo.sudo(
        api.tx.crowdloan.setCrowdloanAllocation(crowdloanRewardsAmount),
      ),
    );

    await waitSudoOperationSuccess(sudoSetCrowdloanAllocationEvents);
  });

  test("crowdloan.initializeCrowdloanRewardVec(rewards)", async () => {
    const userInitializeRewardVec = await signTx(
      api,
      api.tx.crowdloan.initializeRewardVec([
        [
          testUser1.ethAddress.toString(),
          testUser1.ethAddress.toString(),
          crowdloanRewardsAmount,
        ],
      ]),
      testUser1.keyRingPair,
    );

    const eventResponse = getEventResultFromMangataTx(userInitializeRewardVec);

    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("UnknownError");

    const sudoInitializeRewardVec = await Sudo.batchAsSudoFinalized(
      Sudo.sudo(
        api.tx.crowdloan.initializeRewardVec([
          [
            testUser1.ethAddress.toString(),
            testUser1.ethAddress.toString(),
            crowdloanRewardsAmount,
          ],
        ]),
      ),
    );

    await waitSudoOperationSuccess(sudoInitializeRewardVec);
  });

  test("crowdloan.completeCrowdloanInitialization(leaseEndingBlock)", async () => {
    let leaseStartBlock: number;
    let leaseEndingBlock: number;

    leaseStartBlock = (await getBlockNumber()) + 2;
    leaseEndingBlock = (await getBlockNumber()) + 5;

    const userCompleteInitialization = await signTx(
      api,
      api.tx.crowdloan.completeInitialization(
        leaseStartBlock,
        // @ts-ignore
        leaseEndingBlock,
      ),
      testUser1.keyRingPair,
    );

    const eventResponse = getEventResultFromMangataTx(
      userCompleteInitialization,
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
          leaseEndingBlock,
        ),
      ),
    );

    await waitSudoOperationSuccess(sudoCompleteInitialization);

    crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

    await claimCrowdloanRewards(crowdloanId, testUser1).then((result) => {
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  });
});

test("A reward needs to be fully setup with: setCrowdloanAllocation + initializeCrowdloanRewardVec + completeCrowdloanInitialization", async () => {
  await setCrowdloanAllocation(crowdloanRewardsAmount);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await claimCrowdloanRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("RewardVecNotFullyInitializedYet");
  });

  await initializeCrowdloanReward([testUser1], crowdloanRewardsAmount);

  await claimCrowdloanRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("RewardVecNotFullyInitializedYet");
  });

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 10;

  await completeCrowdloanInitialization(leaseStartBlock, leaseEndingBlock);

  await claimCrowdloanRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("CL needs to be setup in order", async () => {
  let leaseStartBlock: number;
  let leaseEndingBlock: number;
  let initializationRewards: MangataGenericEvent[];
  let completionCrowdloan: MangataGenericEvent[];

  initializationRewards = await initializeCrowdloanReward(
    [testUser1],
    crowdloanRewardsAmount,
  );

  await waitSudoOperationFail(initializationRewards, [
    "BatchBeyondFundPot",
    "RewardVecAlreadyInitialized",
  ]);

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 10;

  completionCrowdloan = await completeCrowdloanInitialization(
    leaseStartBlock,
    leaseEndingBlock,
  );

  await waitSudoOperationFail(completionCrowdloan, [
    "RewardsDoNotMatchFund",
    "RewardVecAlreadyInitialized",
  ]);

  const settingAllocation = await setCrowdloanAllocation(
    crowdloanRewardsAmount,
  );

  await waitSudoOperationSuccess(settingAllocation);

  completionCrowdloan = await completeCrowdloanInitialization(
    leaseStartBlock,
    leaseEndingBlock,
  );

  await waitSudoOperationFail(completionCrowdloan, ["RewardsDoNotMatchFund"]);

  initializationRewards = await initializeCrowdloanReward(
    [testUser1],
    crowdloanRewardsAmount,
  );

  await waitSudoOperationSuccess(initializationRewards);

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 5;

  completionCrowdloan = await completeCrowdloanInitialization(
    leaseStartBlock,
    leaseEndingBlock,
  );

  await waitSudoOperationSuccess(completionCrowdloan);
});

test("Total contributors returns the number of contributors per crowdloan AND validation of contributions is done when Initializing the cl rewards", async () => {
  let numberContributors: any;

  await setCrowdloanAllocation(crowdloanRewardsAmount);

  crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  numberContributors = (
    await api.query.crowdloan.totalContributors(crowdloanId)
  ).toHuman();

  expect(numberContributors!.toString()).toEqual("0");

  await initializeCrowdloanReward([testUser1], crowdloanRewardsAmount);

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 5;

  await completeCrowdloanInitialization(leaseStartBlock, leaseEndingBlock);

  numberContributors = (
    await api.query.crowdloan.totalContributors(crowdloanId)
  ).toHuman();

  expect(numberContributors!.toString()).toEqual("1");
});
