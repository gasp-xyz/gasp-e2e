import { ApiPromise, Keyring } from "@polkadot/api";
import { getEnvironmentRequiredVars } from "./utils";
import { User } from "./User";
import "@mangata-finance/types";
import { getApi, initApi } from "./api";
import { Sudo } from "./sudo";
import { Assets } from "./Assets";
import { Xyk } from "./xyk";
import { SudoDB } from "./SudoDB";
import { Codec } from "@polkadot/types-codec/types";
import { signTx } from "@mangata-finance/sdk";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { EthUser } from "./EthUser";
// API
export let api: ApiPromise;

// Users
export let keyring: Keyring;
export let sudo: EthUser;
export let alice: User;
export let eve: User;

export type Extrinsic = SubmittableExtrinsic<"promise">;

export type CodecOrArray = Codec | Codec[];

const processCodecOrArray = (codec: CodecOrArray, fn: (c: Codec) => any) =>
  Array.isArray(codec) ? codec.map(fn) : fn(codec);

export const toHuman = (codec: CodecOrArray) =>
  processCodecOrArray(codec, (c) => c?.toHuman?.() ?? c);
export const toJson = (codec: CodecOrArray) =>
  processCodecOrArray(codec, (c) => c?.toJSON?.() ?? c);
export const toHex = (codec: CodecOrArray) =>
  processCodecOrArray(codec, (c) => c?.toHex?.() ?? c);

export const setupApi = async () => {
  if (!api || (api && !api.isConnected)) {
    await initApi();
    api = getApi();
  }
};
export function isBackendTest() {
  const groupPrefix = "--group=";
  const isThereAPath = process.argv.find((arg) => arg.includes("test/"));
  const isAGroupRun = process.argv.find((arg) => arg.includes(groupPrefix));
  if (
    isThereAPath &&
    isThereAPath.length > 0 &&
    (isThereAPath.toLowerCase().includes("ui") ||
      isThereAPath.toLowerCase().includes("rollup"))
  ) {
    return false;
  }
  return !(
    isAGroupRun &&
    isAGroupRun.length > 0 &&
    (isAGroupRun.toLowerCase().includes("ui") ||
      isAGroupRun.toLowerCase().includes("rollup"))
  );
}
export function getSudoUser(): EthUser {
  return new EthUser(
    new Keyring({ type: "ethereum" }),
    getEnvironmentRequiredVars().ethSudoAddress,
  );
}
export const setupUsers = () => {
  keyring = new Keyring({ type: "ethereum" });
  sudo = getSudoUser();
  //alice = new User(keyring, "//Alice");
  //eve = new User(keyring, "//Eve");

  const testUser1 = new EthUser(keyring);
  const testUser2 = new EthUser(keyring);
  const testUser3 = new EthUser(keyring);
  const testUser4 = new EthUser(keyring);
  const testUser5 = new EthUser(keyring);
  const testUser6 = new EthUser(keyring);

  keyring.addPair(sudo.keyRingPair);
  //keyring.addPair(alice.keyRingPair);
  //keyring.addPair(eve.keyRingPair);
  keyring.addPair(testUser1.keyRingPair);
  keyring.addPair(testUser2.keyRingPair);
  keyring.addPair(testUser3.keyRingPair);
  keyring.addPair(testUser4.keyRingPair);
  keyring.addPair(testUser5.keyRingPair);
  keyring.addPair(testUser6.keyRingPair);

  return [testUser1, testUser2, testUser3, testUser4, testUser5, testUser6];
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
  const tokenIds = await SudoDB.getInstance().getTokenIds(5);
  const mints = [
    Assets.mintToken(tokenIds[0], sudo),
    Assets.mintToken(tokenIds[1], sudo),
    Assets.mintToken(tokenIds[2], sudo),
    Assets.mintToken(tokenIds[3], sudo),
    Assets.mintToken(tokenIds[4], sudo),
  ];

  const poolCreationExtrinsics: Extrinsic[] = [];
  tokenIds.forEach((_, index, tokens) => {
    poolCreationExtrinsics.push(
      Xyk.createPool(
        tokenIds[index],
        Assets.DEFAULT_AMOUNT.divn(2),
        tokenIds[index + (1 % tokens.length)],
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    );
  });
  await Sudo.batchAsSudoFinalized(
    ...mints,
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Assets.mintToken(tokenIds[0], testUser1),
    Assets.mintToken(tokenIds[0], testUser2),
    Assets.mintToken(tokenIds[0], testUser3),
    Assets.mintToken(tokenIds[0], testUser4),
    Assets.mintToken(tokenIds[tokenIds.length - 1], testUser1),
    Assets.mintToken(tokenIds[tokenIds.length - 1], testUser2),
    Assets.mintToken(tokenIds[tokenIds.length - 1], testUser3),
    Assets.mintToken(tokenIds[tokenIds.length - 1], testUser4),
    ...poolCreationExtrinsics,
  );
  return { users, tokenIds };
}
export async function setupAPoolForUsers(users: User[]) {
  const [testUser1, testUser2, testUser3, testUser4] = await setupUsers();
  users = [testUser1, testUser2, testUser3, testUser4];
  const keyring = new Keyring({ type: "sr25519" });
  const sudo = new User(keyring, getEnvironmentRequiredVars().sudo);

  const tokenIds = await SudoDB.getInstance().getTokenIds(2);

  const poolCreationExtrinsics: Extrinsic[] = [];
  poolCreationExtrinsics.push(
    Xyk.createPool(
      tokenIds[0],
      Assets.DEFAULT_AMOUNT.divn(2),
      tokenIds[1],
      Assets.DEFAULT_AMOUNT.divn(2),
    ),
  );

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(tokenIds[0], sudo),
    Assets.mintToken(tokenIds[1], sudo),
    Assets.mintNative(testUser1),
    Assets.mintNative(testUser2),
    Assets.mintNative(testUser3),
    Assets.mintNative(testUser4),
    Assets.mintToken(tokenIds[0], testUser1),
    Assets.mintToken(tokenIds[0], testUser2),
    Assets.mintToken(tokenIds[0], testUser3),
    Assets.mintToken(tokenIds[0], testUser4),
    ...poolCreationExtrinsics,
  );
  return { users, tokenIds };
}
export const setupGasLess = async (force = false) => {
  keyring = new Keyring({ type: "ecdsa" });
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();
  sudo = new User(keyring, sudoUserName) as EthUser;
  alice = new User(keyring, "//Alice");
  await setupApi();
  const feeLockConfig = JSON.parse(
    JSON.stringify(await api?.query.feeLock.feeLockMetadata()),
  );
  // only create if empty.
  if (feeLockConfig === null || feeLockConfig.periodLength === null || force) {
    const extrinsic = api!.tx.feeLock
      .updateFeeLockMetadata(
        10,
        "50000000000000000000",
        "1000000000000000000000",
        [[1, false]],
      )
      .toString();
    await signTx(api!, api!.tx.sudo.sudo(extrinsic), sudo.keyRingPair, {
      nonce: await SudoDB.getInstance().getSudoNonce(sudo.keyRingPair.address),
    });
  }
};
