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
import { Asset, User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  getBlockNumber,
  waitForNBlocks,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { signTx, toBN } from "@mangata-finance/sdk";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapPhase: any;
let bootstrapCurrency: any;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 10;
const bootstrapPeriod = 30;

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

  bootstrapCurrency = await Assets.issueAssetToUser(sudo, 1, sudo);
});

beforeEach(async () => {
  // setup users
  testUser1 = new User(keyring);

  // add users to pair.
  keyring.addPair(testUser1.keyRingPair);

  await testUser1.addMGATokens(sudo);
});

test("xyk-pallet - Check non-sudo user cannot start bootstrap", async () => {
  // check that non-sudo user can not start bootstrap
  const api = getApi();
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  const bootstrapBlockNumber = (await getBlockNumber()) + waitingPeriod;
  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.bootstrap.scheduleBootstrap(
        MGA_ASSET_ID,
        bootstrapCurrency,
        bootstrapBlockNumber,
        new BN(1),
        new BN(bootstrapPeriod),
        [100, 1]
      )
    ),
    testUser1.keyRingPair,
    {
      nonce: await getCurrentNonce(testUser1.keyRingPair.address),
    }
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  });
});

test("xyk-pallet - Check happy path", async () => {
  // check that sudo user can start bootstrap
  const api = getApi();
  await sudo.mint(bootstrapCurrency, sudo, toBN("1", 20));
  const bootstrapBlockNumber = (await getBlockNumber()) + waitingPeriod;
  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.bootstrap.scheduleBootstrap(
        MGA_ASSET_ID,
        bootstrapCurrency,
        bootstrapBlockNumber,
        new BN(1),
        new BN(bootstrapPeriod),
        [100, 1]
      )
    ),
    sudo.keyRingPair,
    {
      nonce: await getCurrentNonce(sudo.keyRingPair.address),
    }
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  // check that user can not make provision before bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "BeforeStart") {
    await signTx(
      api,
      api.tx.bootstrap.provision(bootstrapCurrency, new BN(10000000)),
      testUser1.keyRingPair,
      {
        nonce: await getCurrentNonce(testUser1.keyRingPair.address),
      }
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("checking BeforeStart phase's provision did not pass");
  }
  await waitForNBlocks(waitingPeriod);

  // check that user can make provision while bootstrap running
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Public") {
    await signTx(
      api,
      api.tx.bootstrap.provision(MGA_ASSET_ID, new BN(10000000000)),
      testUser1.keyRingPair,
      {
        nonce: await getCurrentNonce(testUser1.keyRingPair.address),
      }
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await signTx(
      api,
      api.tx.bootstrap.provision(bootstrapCurrency, new BN(10000000)),
      testUser1.keyRingPair,
      {
        nonce: await getCurrentNonce(testUser1.keyRingPair.address),
      }
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("checking Public phase's provision did not pass");
  }
  await waitForNBlocks(bootstrapPeriod);

  // check that user can not make provision after bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    await signTx(
      api,
      api.tx.bootstrap.provision(bootstrapCurrency, new BN(10000000)),
      testUser1.keyRingPair,
      {
        nonce: await getCurrentNonce(testUser1.keyRingPair.address),
      }
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    });
  } else {
    // eslint-disable-next-line jest/no-jasmine-globals
    fail("checking Finished phase's provision did not pass");
  }
});

test("xyk-pallet - Check finalize", async () => {
  const api = getApi();
  await signTx(
    api,
    api.tx.sudo.sudo(api.tx.bootstrap.finalize()),
    sudo.keyRingPair,
    {
      nonce: await getCurrentNonce(sudo.keyRingPair.address),
    }
  );
});
