import { ApiPromise, Keyring } from "@polkadot/api";
import { getEnvironmentRequiredVars } from "./utils";
import { User } from "./User";
import "@mangata-finance/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { getApi, initApi } from "./api";
import { signTx } from "@mangata-finance/sdk";

// API
export let api: ApiPromise;

// Users
export let keyring: Keyring;
export let sudo: User;
export let alice: User;

export type Extrinsic = SubmittableExtrinsic<"promise">;

export const setupApi = async () => {
  if (!api || (api && !api.isConnected)) {
    await initApi();
    api = getApi();
  }
};

export const setupUsers = () => {
  keyring = new Keyring({ type: "sr25519" });
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  sudo = new User(keyring, sudoUserName);
  alice = new User(keyring, "//Alice");
  const testUser1 = new User(keyring);
  const testUser2 = new User(keyring);
  const testUser3 = new User(keyring);
  const testUser4 = new User(keyring);

  keyring.addPair(sudo.keyRingPair);
  keyring.addPair(alice.keyRingPair);
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(testUser3.keyRingPair);
  keyring.addPair(testUser4.keyRingPair);

  return [testUser1, testUser2, testUser3, testUser4];
};
export const setupGassLess = async () => {
  keyring = new Keyring({ type: "sr25519" });
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  sudo = new User(keyring, sudoUserName);
  alice = new User(keyring, "//Alice");
  await setupApi();
  const tokenTimeoutConfig = JSON.parse(
    JSON.stringify(await api?.query.feeLock.feeLockMetadata())
  );
  // only create if empty.
  if (tokenTimeoutConfig === null || tokenTimeoutConfig.periodLength === null) {
    await signTx(
      api!,
      api!.tx.sudo.sudo(
        api!.tx.feeLock.updateFeeLockMetadata(10, 10, 10, [[1, false]])
      ),
      sudo.keyRingPair
    );
  }
};
