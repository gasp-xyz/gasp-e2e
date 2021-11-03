/* eslint-disable no-console */
import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { utils, PrivateKey, PublicKey } from "eciesjs";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function transferEncExample(api: ApiPromise, ferdie: KeyringPair) {
  return api.createType("Vec<Call>", [
    api.tx.tokens.transfer(ferdie.address, 0, 7e15),
  ]);
}

export function createEncryptedTx(
  api: ApiPromise,
  alice_pub_key: any,
  user: KeyringPair,
  transactions: any
) {
  const tx_call = transactions;
  const dummy_private_key = getUserPrivateKey();
  const user_aes_key = getUserPrivateAesKey(dummy_private_key, alice_pub_key);
  const collatorPublicAesKey = getCollatorAesKey(
    dummy_private_key,
    alice_pub_key
  );
  //// final encryption key
  const singly_encrypted = utils.aesEncrypt(
    user_aes_key,
    Buffer.from(tx_call.toU8a())
  );
  const doubly_encrypted = utils.aesEncrypt(
    collatorPublicAesKey,
    singly_encrypted
  );
  console.log(`call ${tx_call.toU8a()}`);
  console.log(`singly encrypted ${Array.from(singly_encrypted)}`);
  console.log(`doubly encrypted ${Array.from(doubly_encrypted)}`);
  const call = Array.from(doubly_encrypted);
  // nonce most likely will be removed but should be unique for every transaction
  const tx = api.tx.encryptedTransactions.submitDoublyEncryptedTransaction(
    call,
    1,
    5000000000,
    user.address,
    user.address
  );
  return tx;
}
export function getCollatorAesKey(
  dummy_private_key: PrivateKey,
  alice_pub_key: string
) {
  return getUserPrivateAesKey(dummy_private_key, alice_pub_key);
}
export function getUserPrivateAesKey(
  dummy_private_key: PrivateKey,
  alice_pub_key: string
) {
  return dummy_private_key.encapsulate(PublicKey.fromHex(alice_pub_key));
}
export function getUserPrivateKey() {
  /// secret key is [0,0,0,0,0, ..., 1] len (33)
  const length = 31;
  const key = Uint8Array.from(new Array(length).fill(0).concat(1));
  const secret_for_dummy_key_hex = Buffer.from(key).toString("hex");

  return PrivateKey.fromHex(secret_for_dummy_key_hex);
}
export async function getUserPublicKey(api: ApiPromise, user: KeyringPair) {
  const key_map = JSON.parse(
    (await api.query.encryptedTransactions.keyMap()).toString()
  );
  const alice_pub_key = key_map[user.address];
  return alice_pub_key;
}
