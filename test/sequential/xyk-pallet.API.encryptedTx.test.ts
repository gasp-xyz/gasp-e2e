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
import { getUserPublicKey, createEncryptedTx } from "../../utils/encTxHandler";
import { getValidSecret } from "eciesjs/dist/utils";

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
  // Constuct the keyring after the API (crypto has an async init)
  const keyring = new Keyring({ type: "sr25519" });
  // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
  const alice = keyring.addFromUri("//Alice");
  const ferdie = keyring.addFromUri("//Ferdie");
  // fetch all keys from ETX storage
  const alice_pub_key = await getUserPublicKey(api, alice);
  getValidSecret();
  const tx = createEncryptedTx(api, ferdie, alice_pub_key, alice);
  console.info(`TX: ${await tx.signAndSend(alice)}`);
  await api.rpc.chain.subscribeNewHeads(async (lastHeader) => {
    const currentBlockEvents = await api.query.system.events.at(
      lastHeader.hash
    );
    console.info("!!!!!! EVENTS !!!!!!");
    // console.log(currentBlockEvents.toHuman())
    currentBlockEvents.forEach(({ event: { data, method, section } }) => {
      console.info(`${section}::${method} : ${data}`);
    });
  });
});
