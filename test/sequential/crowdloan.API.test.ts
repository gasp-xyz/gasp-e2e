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
import { getBlockNumber, getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import {
  ExtrinsicResult,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";

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
    // @ts-ignore
    api.tx.crowdloan.completeInitialization(leaseStartBlock, leaseEndingBlock),
    testUser1.keyRingPair
  );

  const eventResponse = getEventResultFromMangataTx(userCompleteInitialization);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual("UnknownError");

  const sudoCompleteInitialization = await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      // @ts-ignore
      api.tx.crowdloan.completeInitialization(leaseStartBlock, leaseEndingBlock)
    )
  );

  await waitSudoOperationSuccess(sudoCompleteInitialization);
});

test("A user can only change his reward-address with: crowdloan.updateRewardAddress(newRewardAccount)", async () => {
  const [testUser3] = setupUsers();

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser3),
    Sudo.sudo(api.tx.crowdloan.setCrowdloanAllocation(millionNative))
  );

  await Sudo.batchAsSudoFinalized(
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

  const leaseStartBlock = (await getBlockNumber()) + 5;
  const leaseEndingBlock = (await getBlockNumber()) + 20;

  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      // @ts-ignore
      api.tx.crowdloan.completeInitialization(leaseStartBlock, leaseEndingBlock)
    )
  );

  const updateRewardAddress = await signTx(
    api,
    // @ts-ignore
    api.tx.crowdloan.updateRewardAddress(testUser3.keyRingPair.address, null),
    testUser1.keyRingPair
  );

  const eventResponse = getEventResultFromMangataTx(updateRewardAddress);

  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const crowdloanId = (await api.query.crowdloan.crowdloanId()).toHuman();

  await signTx(
    api,
    // @ts-ignore
    api.tx.crowdloan.claim(crowdloanId),
    testUser1.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NoAssociatedClaim");
  });

  await signTx(
    api,
    // @ts-ignore
    api.tx.crowdloan.claim(crowdloanId),
    testUser3.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await signTx(
    api,
    // @ts-ignore
    api.tx.crowdloan.claim(crowdloanId),
    testUser2.keyRingPair
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});
