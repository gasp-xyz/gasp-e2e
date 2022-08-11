import { ApiPromise, Keyring } from "@polkadot/api";
import { getEnvironmentRequiredVars } from "../utils";
import { User } from "../User";
import "@mangata-finance/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { getApi, initApi } from "../api";

// API
export let api: ApiPromise;

// Users
export let keyring: Keyring;
export let sudo: User;
export let testUser1: User;
export let testUser2: User;
export let testUser3: User;
export let testUser4: User;

export type Extrinsic = SubmittableExtrinsic<"promise">;

export const setupApi = async () => {
  if (api) {
    await api.disconnect();
  }
  await initApi();
  api = getApi();
};

export const setupUsers = () => {
  keyring = new Keyring({ type: "sr25519" });
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring);
  testUser2 = new User(keyring);
  testUser3 = new User(keyring);
  testUser4 = new User(keyring);

  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(testUser3.keyRingPair);
  keyring.addPair(testUser4.keyRingPair);

  return [testUser1, testUser2, testUser3, testUser4];
};
