import { ApiPromise, Keyring } from "@polkadot/api";
import { getEnvironmentRequiredVars } from "./utils";
import { User } from "./User";
import "@mangata-finance/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { getApi, initApi } from "./api";
import { Sudo } from "./sudo";
import { Assets } from "./Assets";
import { BN } from "@mangata-finance/sdk";
import { Xyk } from "./xyk";
import { signTx } from "@mangata-finance/sdk";
import { SudoDB } from "./SudoDB";

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

export const devTestingPairs = (ss58Format?: number) => {
  const keyring = new Keyring({ type: "sr25519", ss58Format });
  const alice = keyring.addFromUri("//Alice");
  const bob = keyring.addFromUri("//Bob");
  const charlie = keyring.addFromUri("//Charlie");
  const dave = keyring.addFromUri("//Dave");
  const eve = keyring.addFromUri("//Eve");
  return {
    alice,
    bob,
    charlie,
    dave,
    eve,
    keyring,
  };
};

export async function setup5PoolsChained(users: User[]) {
  const [testUser1, testUser2, testUser3, testUser4] = await setupUsers();
  users = [testUser1, testUser2, testUser3, testUser4];
  const keyring = new Keyring({ type: "sr25519" });
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const events = await Sudo.batchAsSudoFinalized(
    Assets.issueToken(sudo),
    Assets.issueToken(sudo),
    Assets.issueToken(sudo),
    Assets.issueToken(sudo),
    Assets.issueToken(sudo)
  );
  const tokenIds: BN[] = events
    .filter((item) => item.method === "Issued" && item.section === "tokens")
    .map((x) => new BN(x.eventData[0].data.toString()));

  const poolCreationExtrinsics: Extrinsic[] = [];
  tokenIds.forEach((_, index, tokens) => {
    poolCreationExtrinsics.push(
      Xyk.createPool(
        tokenIds[index],
        Assets.DEFAULT_AMOUNT.divn(2),
        tokenIds[index + (1 % tokens.length)],
        Assets.DEFAULT_AMOUNT.divn(2)
      )
    );
  });
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Assets.mintToken(tokenIds[0], testUser1),
    Assets.mintToken(tokenIds[0], testUser2),
    Assets.mintToken(tokenIds[0], testUser3),
    Assets.mintToken(tokenIds[0], testUser4),
    ...poolCreationExtrinsics
  );
  return { users, tokenIds };
}
export async function setupAPoolForUsers(users: User[]) {
  const [testUser1, testUser2, testUser3, testUser4] = await setupUsers();
  users = [testUser1, testUser2, testUser3, testUser4];
  const keyring = new Keyring({ type: "sr25519" });
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);
  const events = await Sudo.batchAsSudoFinalized(
    Assets.issueToken(sudo),
    Assets.issueToken(sudo)
  );
  const tokenIds: BN[] = events
    .filter((item) => item.method === "Issued" && item.section === "tokens")
    .map((x) => new BN(x.eventData[0].data.toString()));

  const poolCreationExtrinsics: Extrinsic[] = [];
  poolCreationExtrinsics.push(
    Xyk.createPool(
      tokenIds[0],
      Assets.DEFAULT_AMOUNT.divn(2),
      tokenIds[1],
      Assets.DEFAULT_AMOUNT.divn(2)
    )
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Assets.mintToken(tokenIds[0], testUser1),
    Assets.mintToken(tokenIds[0], testUser2),
    Assets.mintToken(tokenIds[0], testUser3),
    Assets.mintToken(tokenIds[0], testUser4),
    ...poolCreationExtrinsics
  );
  return { users, tokenIds };
}
export const setupGasLess = async (force = false) => {
  keyring = new Keyring({ type: "sr25519" });
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  sudo = new User(keyring, sudoUserName);
  alice = new User(keyring, "//Alice");
  await setupApi();
  const feeLockConfig = JSON.parse(
    JSON.stringify(await api?.query.feeLock.feeLockMetadata())
  );
  // only create if empty.
  if (feeLockConfig === null || feeLockConfig.periodLength === null || force) {
    await signTx(
      api!,
      api!.tx.sudo.sudo(
        api!.tx.feeLock.updateFeeLockMetadata(
          10,
          "50000000000000000000",
          "1000000000000000000000",
          [[1, false]]
        )
      ),
      sudo.keyRingPair,
      {
        nonce: await SudoDB.getInstance().getSudoNonce(
          sudo.keyRingPair.address
        ),
      }
    );
  }
};
