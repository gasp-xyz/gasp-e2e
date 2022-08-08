import { ApiPromise, Keyring } from "@polkadot/api";
import { getEnvironmentRequiredVars } from "../utils";
import { User } from "../User";
import "@mangata-finance/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { getApi, initApi } from "../api";

// API
export let api: ApiPromise;

// Users
export const { sudo: sudoUserName } = getEnvironmentRequiredVars();
export let sudo: User;
export let testUser1: User;
export let testUser2: User;
export let testUser3: User;
export let testUser4: User;

export type Extrinsic = SubmittableExtrinsic<"promise">;

export const setupApi = async (uri = "ws://127.0.0.1:9948") => {
  await initApi(uri);
  api = getApi();
};

export const setupUsers = () => {
  const keyring = new Keyring({ type: "sr25519" });
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
};
