/* eslint-disable no-console */
/*
 *
 * @group xyk
 * @group api
 * @group sequential
 * @group critical
 */

import { ApiPromise, Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import {
  getUserPublicKey,
  createEncryptedTx,
  transferEncExample,
  waitUntilTxIsprocessed,
} from "../../utils/encTxHandler";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";
import { Node } from "../../utils/Framework/Node/Node";
import { waitForNBlocks } from "../../utils/utils";
import BN from "bn.js";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { validateEncrytedTxEvents } from "../../utils/validators";
import { NodeUser } from "../../utils/Framework/User/NodeUser";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let api: ApiPromise;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  api = getApi();
});

beforeEach(async () => {});

test("xyk-pallet - Encrypt a transaction - OK : Transfer", async () => {
  const node = new Node("", api);
  const node2 = new Node("", api);
  const keyring = new Keyring({ type: "sr25519" });
  const ferdie = new NodeUser(keyring, "//Ferdie", node);
  const alice = new NodeUser(keyring, "//Alice", node2);
  ferdie.node.subscribeToHead();
  alice.node.subscribeToHead();
  ferdie.node.subscribeToTransactionsEvents();
  alice.node.subscribeToTransactionsEvents();
  ferdie.node.subscribeToUserBalanceChanges(ferdie);
  alice.node.subscribeToUserBalanceChanges(alice);

  const alice_pub_key = await getUserPublicKey(api, alice.keyRingPair);
  const txs = transferEncExample(api, ferdie.keyRingPair);
  const txValue = JSON.parse(txs.toString())[0].args.value;
  const nonce = 1;
  const tx = createEncryptedTx(
    api,
    alice_pub_key,
    alice.keyRingPair,
    txs,
    nonce
  );

  await waitForNBlocks(1);

  await signSendAndWaitToFinishTx(tx, alice.keyRingPair);
  const userEvents = await waitUntilTxIsprocessed(
    ferdie.node,
    alice.keyRingPair.address,
    nonce,
    txValue
  );
  //At this time the Tx must be finished. Lets get the first and lates balance update.
  const [ferdieBefore, ferdieAfter, aliceBefore, aliceAfter] = [
    ferdie.userBalancesHistory.get(
      ferdie.userBalancesHistory.keys().next().value
    )!,
    ferdie.userBalancesHistory.get(ferdie.node.lastBlock! - 1)!,
    alice.userBalancesHistory.get(
      alice.userBalancesHistory.keys().next().value
    )!,
    alice.userBalancesHistory.get(alice.node.lastBlock! - 1)!,
  ];
  const mangataAssetId = MGA_ASSET_ID.toNumber();
  if (ferdieBefore.get(mangataAssetId)?.free === undefined) {
    ferdieBefore.set(mangataAssetId, {
      free: new BN(0),
      reserved: new BN(0),
      miscFrozen: new BN(0),
      feeFrozen: new BN(0),
    });
  }
  expect(
    ferdieBefore.get(mangataAssetId)?.free.add(new BN((7e15).toString()))
  ).bnEqual(ferdieAfter.get(mangataAssetId)?.free!);
  //validate that this cost some cash! before - transfered > after (because of fees).
  expect(
    aliceBefore.get(mangataAssetId)?.free.sub(new BN((7e15).toString()))
  ).bnGreaterThan(aliceAfter.get(mangataAssetId)?.free!);
  //validate that the required events are present
  validateEncrytedTxEvents(userEvents);
});
