/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import { getCurrentNonce } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  getBlockNumber,
  waitForNBlocks,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID, KSM_ASSET_ID } from "../../utils/Constants";
import { signTx } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapPhase: any;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 25;
const bootstrapPeriod = 50;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);

  //add MGA tokens for sudo user.
  await sudo.addMGATokens(sudo);

  keyring.addPair(sudo.keyRingPair);
});

beforeEach(async () => {
  // setup users
  testUser1 = new User(keyring);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);

  await testUser1.addMGATokens(sudo);
});

test("xyk-pallet - Check starting bootstrap", async () => {
  // check that non-sudo user can't start bootstrap
  const api = getApi();
  await testUser1.addKSMTokens(sudo);
  const bootstrapBlockNumber1 = (await getBlockNumber()) + waitingPeriod;
  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.bootstrap.scheduleBootstrap(
        MGA_ASSET_ID,
        KSM_ASSET_ID,
        bootstrapBlockNumber1,
        new BN(1),
        new BN(bootstrapPeriod),
        [100000, 1]
      )
    ),
    testUser1.keyRingPair,
    {
      nonce: await getCurrentNonce(testUser1.keyRingPair.address),
    }
  ).then((result1) => {
    const eventResponse1 = getEventResultFromMangataTx(result1);
    expect(eventResponse1.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  });
  // check that sudo user can start bootstrap
  await sudo.addKSMTokens(sudo);
  const bootstrapBlockNumber2 = (await getBlockNumber()) + waitingPeriod;
  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.bootstrap.scheduleBootstrap(
        MGA_ASSET_ID,
        KSM_ASSET_ID,
        bootstrapBlockNumber2,
        new BN(1),
        new BN(bootstrapPeriod),
        [100000, 1]
      )
    ),
    sudo.keyRingPair,
    {
      nonce: await getCurrentNonce(sudo.keyRingPair.address),
    }
  ).then((result2) => {
    const eventResponse2 = getEventResultFromMangataTx(result2);
    expect(eventResponse2.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("xyk-pallet - Check provision bootstrap", async () => {
  const api = getApi();
  await testUser1.addKSMTokens(sudo);
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "BeforeStart") {
    await signTx(
      api,
      api.tx.bootstrap.provision(KSM_ASSET_ID, new BN(10000000)),
      testUser1.keyRingPair,
      {
        nonce: await getCurrentNonce(testUser1.keyRingPair.address),
      }
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });
  }
  await waitForNBlocks(waitingPeriod);
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Public") {
    await signTx(
      api,
      api.tx.bootstrap.provision(KSM_ASSET_ID, new BN(10000000)),
      testUser1.keyRingPair,
      {
        nonce: await getCurrentNonce(testUser1.keyRingPair.address),
      }
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  }
  await waitForNBlocks(bootstrapPeriod);
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    await signTx(
      api,
      api.tx.bootstrap.provision(KSM_ASSET_ID, new BN(10000000)),
      testUser1.keyRingPair,
      {
        nonce: await getCurrentNonce(testUser1.keyRingPair.address),
      }
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });
  }
});
