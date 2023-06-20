import { promises, constants } from "fs";
const file = "sudo.lock";

export const lockSudoFile = function (): any {
  const lockPath = file;
  return promises
    .open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR)
    .catch(() => lockSudoFile());
};
export const unlockSudoFile = function (): any {
  const lockPath = file;
  return promises.unlink(lockPath).catch(() => unlockSudoFile());
};

export const removeSudoDb = function () {
  const lockPath = "nonce.db";
  return promises.unlink(lockPath).catch(() => {});
};
