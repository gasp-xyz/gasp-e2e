/*
 *
 * @group xyk
 * @group sudo
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getCurrentNonce } from "../../utils/tx";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@polkadot/util";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { signTx } from "@mangata-finance/sdk";
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let sudo: User;

let keyring: Keyring;
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
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  sudo = new User(keyring, sudoUserName);

  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(sudo.keyRingPair);

  await testUser1.addMGATokens(sudo);
  testUser1.addAsset(MGA_ASSET_ID);
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
});

beforeEach(async () => {
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
});

test("xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.create]", async () => {
  const api = getApi();

  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.tokens.create(testUser2.keyRingPair.address, new BN(10000000)),
    ),
    testUser1.keyRingPair,
    {
      nonce: new BN(
        await (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber(),
      ),
    },
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  });
});

test("xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.create to itself]", async () => {
  const api = getApi();

  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.tokens.create(testUser1.keyRingPair.address, new BN(10000000)),
    ),
    testUser1.keyRingPair,
    {
      nonce: new BN(
        await (await getCurrentNonce(testUser1.keyRingPair.address)).toNumber(),
      ),
    },
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  });
});

test("xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.mint]", async () => {
  const api = getApi();

  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.tokens.mint(
        new BN(0),
        testUser2.keyRingPair.address,
        new BN(100000),
      ),
    ),
    testUser1.keyRingPair,
    {
      nonce: await getCurrentNonce(testUser1.keyRingPair.address),
    },
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  });
});

test("xyk-pallet - SecurityTests - Only sudo can perform actions [tokens.mint to itself]", async () => {
  const api = getApi();

  await signTx(
    api,
    api.tx.sudo.sudo(
      api.tx.tokens.mint(
        new BN(0),
        testUser1.keyRingPair.address,
        new BN(100000),
      ),
    ),
    testUser1.keyRingPair,
    { nonce: await getCurrentNonce(testUser1.keyRingPair.address) },
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  });
});

afterEach(async () => {
  await testUser1.refreshAmounts(AssetWallet.AFTER);
  const assetValue = testUser1.getAsset(MGA_ASSET_ID);
  expect(assetValue?.amountAfter.free).bnLt(assetValue?.amountBefore.free!);
});
