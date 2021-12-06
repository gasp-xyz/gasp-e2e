const file = "sudo.lock";
const {promises, constants} = require("fs");

export const lockSudoFile = function () {
  const lockPath = file;
  return promises
    .open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR)
    .catch(() => lockSudoFile());
};
export const unlockSudoFile = function () {
  const lockPath = file;
  return promises.unlink(lockPath).catch(() => unlockSudoFile());
};
