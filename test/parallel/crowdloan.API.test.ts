/*
 *
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
import {
  getBlockNumber,
  getEnvironmentRequiredVars,
  waitBlockNumber,
} from "../../utils/utils";
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
let api: ApiPromise;
let sudo: User;
let keyring: Keyring;
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

  [testUser1, testUser2] = setupUsers();

  testUser1.addAsset(nativeCurrencyId);
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(sudo),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2)
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
        millionNative.divn(2),
      ],
      [
        testUser2.keyRingPair.address,
        testUser2.keyRingPair.address,
        millionNative.divn(2),
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
          millionNative.divn(2),
        ],
        [
          testUser2.keyRingPair.address,
          testUser2.keyRingPair.address,
          millionNative.divn(2),
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
          testUser2.keyRingPair.address,
          millionNative.divn(2),
        ],
        [
          testUser2.keyRingPair.address,
          testUser2.keyRingPair.address,
          millionNative.divn(2),
        ],
      ])
    )
  );

  const leaseStartBlock = (await getBlockNumber()) + 5;
  const leaseEndingBlock = (await getBlockNumber()) + 20;

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
});

test("A user can only change his reward-address with: crowdloan.updateRewardAddress(newRewardAccount)", async () => {
  const [testUser3] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser3));

  await setCrowdloanAllocation(millionNative);

  await initializeReward(testUser1, testUser2, millionNative.divn(2));

  const leaseStartBlock = (await getBlockNumber()) + 2;
  const leaseEndingBlock = (await getBlockNumber()) + 15;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  await signTx(
    api,
    // @ts-ignore
    api.tx.crowdloan.updateRewardAddress(testUser3.keyRingPair.address, null),
    testUser1.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();
  const currentBlockNumber = await getBlockNumber();

  expect(new BN(currentBlockNumber)).bnLt(new BN(leaseEndingBlock));

  await claimRewards(crowdloanId, testUser2).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await waitBlockNumber(leaseEndingBlock.toString(), 15);

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("NoAssociatedClaim");
  });

  await claimRewards(crowdloanId, testUser3).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("A reward needs to be fully setup with: setCrowdloanAllocation + initializeRewardVec + completeInitialization", async () => {
  await setCrowdloanAllocation(millionNative);

  const crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await claimRewards(crowdloanId, testUser1).then((result) => {
    expect(result.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(result.data).toEqual("RewardVecNotFullyInitializedYet");
  });

  await initializeReward(testUser1, testUser2, millionNative.divn(2));

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
  let initializationOfRewards: MangataGenericEvent[];
  let initializationOfCrowdloan: MangataGenericEvent[];
  let BootstrapError: RegistryError;

  initializationOfRewards = await initializeReward(
    testUser1,
    testUser2,
    millionNative.divn(2)
  );

  BootstrapError = await getEventErrorFromSudo(
    initializationOfRewards.filter(
      (extrinsicResult) => extrinsicResult.method === "Sudid"
    )
  );

  if ((BootstrapError.method = "BatchBeyondFundPot")) {
    await waitSudoOperationFail(initializationOfRewards, "BatchBeyondFundPot");
  } else {
    await waitSudoOperationFail(
      initializationOfRewards,
      "RewardVecAlreadyInitialized"
    );
  }

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 10;

  initializationOfCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  BootstrapError = await getEventErrorFromSudo(
    initializationOfCrowdloan.filter(
      (extrinsicResult) => extrinsicResult.method === "Sudid"
    )
  );

  if ((BootstrapError.method = "RewardsDoNotMatchFund")) {
    await waitSudoOperationFail(
      initializationOfCrowdloan,
      "RewardsDoNotMatchFund"
    );
  } else {
    await waitSudoOperationFail(
      initializationOfCrowdloan,
      "RewardVecAlreadyInitialized"
    );
  }

  await setCrowdloanAllocation(millionNative);

  const crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  initializationOfCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  await waitSudoOperationFail(
    initializationOfCrowdloan,
    "RewardsDoNotMatchFund"
  );

  initializationOfRewards = await initializeReward(
    testUser1,
    testUser2,
    millionNative.divn(2)
  );

  await waitSudoOperationSuccess(initializationOfRewards);

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 10;

  initializationOfCrowdloan = await completeInitialization(
    leaseStartBlock,
    leaseEndingBlock
  );

  await waitSudoOperationSuccess(initializationOfCrowdloan);
});

test("A user can claim some rewards if it provided some on the specified cl_id", async () => {
  let leaseStartBlock: number;
  let leaseEndingBlock: number;

  const [testUser3, testUser4] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4)
  );

  await setCrowdloanAllocation(millionNative);

  const firstCrowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await initializeReward(testUser1, testUser2, millionNative.divn(2));

  leaseStartBlock = (await getBlockNumber()) + 2;
  leaseEndingBlock = (await getBlockNumber()) + 5;

  await completeInitialization(leaseStartBlock, leaseEndingBlock);

  await waitBlockNumber(leaseEndingBlock.toString(), 10);

  await setCrowdloanAllocation(millionNative);

  const secondCrowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await initializeReward(testUser3, testUser4, millionNative.divn(2));

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

async function setCrowdloanAllocation(crowdloanAllocationAmount: BN) {
  const setCrowdloanAllocation = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.setCrowdloanAllocation(crowdloanAllocationAmount)
    )
  );

  return setCrowdloanAllocation;
}

async function initializeReward(
  user1: User,
  user2: User,
  Balance1: BN,
  Balance2 = Balance1
) {
  const initializeReward = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      api.tx.crowdloan.initializeRewardVec([
        [user1.keyRingPair.address, user1.keyRingPair.address, Balance1],
        [user2.keyRingPair.address, user2.keyRingPair.address, Balance2],
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
