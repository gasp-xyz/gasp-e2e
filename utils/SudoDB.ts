/* eslint-disable no-loop-func */
/* eslint-disable no-console */
import { Guid } from "guid-typescript";
import { testLog } from "./Logger";
import { getCandidates, getCurrentNonce } from "./txHandler";
import { sleep } from "./utils";
import ipc from "node-ipc";
import { BN } from "@polkadot/util";
export class SudoDB {
  private static instance: SudoDB;

  // build the singleton.
  public static getInstance(): SudoDB {
    if (!SudoDB.instance) {
      SudoDB.instance = new SudoDB();
    }
    return SudoDB.instance;
  }

  public async getSudoNonce(sudoAddress: string) {
    if (
      process.env.VSCODE_INSPECTOR_OPTIONS !== undefined &&
      process.env.VSCODE_INSPECTOR_OPTIONS!.length > 0 &&
      process.env.PERF_TEST === undefined
    ) {
      return await getCurrentNonce(sudoAddress);
    }

    let dbNonce = -1;
    if (process.argv.includes("--runInBand")) {
      return await getCurrentNonce(sudoAddress);
    }
    dbNonce = await getNonceFromIPC();
    await sleep(1000);
    testLog
      .getLog()
      .info(`[${process.env.JEST_WORKER_ID}] Returned nonce: ${dbNonce}`);
    return dbNonce;
  }
  public async getNextCandidateNum() {
    if (process.argv.includes("--runInBand")) {
      return await getCandidates();
    }
    const nextCandidateId = await getCandidateCountFromIPC();
    await sleep(1000);
    testLog
      .getLog()
      .info(
        `[${process.env.JEST_WORKER_ID}] Returned nextCandidateId : ${nextCandidateId}`,
      );
    return nextCandidateId;
  }

  public async getTokenId() {
    const tokenIdfromRpc = await getTokenIdFromIPC();
    await sleep(1000);
    testLog
      .getLog()
      .info(
        `[${process.env.JEST_WORKER_ID}] Returned tokenIdfromRpc : ${tokenIdfromRpc}`,
      );
    return new BN(tokenIdfromRpc);
  }

  public async getTokenIds(number: number) {
    const tokenIds: BN[] = [];
    for (let i = 0; i < number; i++) {
      tokenIds.push(await this.getTokenId());
    }
    return tokenIds;
  }
}
async function getNonceFromIPC(): Promise<number> {
  return new Promise(function (resolve) {
    ipc.config.id = Guid.create().toString();
    ipc.config.retry = 1500;
    ipc.config.silent = false;

    ipc.connectTo("nonceManager", () => {
      ipc.of.nonceManager.on("connect", () => {
        ipc.of.nonceManager.emit("getNonce", {
          id: ipc.config.id,
          message: `[${process.env.JEST_WORKER_ID}] I need a nonce`,
        });
        testLog
          .getLog()
          .info(`[${process.env.JEST_WORKER_ID}] Waiting for nonce`);
      });
      ipc.of.nonceManager.on("nonce-" + ipc.config.id, (data: number) => {
        testLog
          .getLog()
          .info(`[${process.env.JEST_WORKER_ID}] I got this ${data}`);
        ipc.disconnect("nonceManager");
        resolve(data);
      });
    });
  });
}
async function getCandidateCountFromIPC(): Promise<number> {
  return new Promise(function (resolve) {
    ipc.config.id = Guid.create().toString();
    ipc.config.retry = 1500;
    ipc.config.silent = false;

    ipc.connectTo("nonceManager", () => {
      ipc.of.nonceManager.on("connect", () => {
        ipc.of.nonceManager.emit("getCandidate", {
          id: ipc.config.id,
          message: `[${process.env.JEST_WORKER_ID}] I need a getCandidate`,
        });
        testLog
          .getLog()
          .info(`[${process.env.JEST_WORKER_ID}] Waiting for getCandidate`);
      });
      ipc.of.nonceManager.on("candidate-" + ipc.config.id, (data: number) => {
        testLog
          .getLog()
          .info(`[${process.env.JEST_WORKER_ID}] I got this ${data}`);
        ipc.disconnect("nonceManager");
        resolve(data);
      });
    });
  });
}
async function getTokenIdFromIPC(): Promise<string> {
  return new Promise(function (resolve) {
    ipc.config.id = Guid.create().toString();
    ipc.config.retry = 1500;
    ipc.config.silent = false;

    ipc.connectTo("nonceManager", () => {
      ipc.of.nonceManager.on("connect", () => {
        ipc.of.nonceManager.emit("getTokenId", {
          id: ipc.config.id,
          message: `[${process.env.JEST_WORKER_ID}] I need a token id`,
        });
        testLog
          .getLog()
          .info(`[${process.env.JEST_WORKER_ID}] Waiting for getTokenId`);
      });
      ipc.of.nonceManager.on("TokenId-" + ipc.config.id, (data: string) => {
        testLog
          .getLog()
          .info(`[${process.env.JEST_WORKER_ID}] I got this ${data}`);
        ipc.disconnect("nonceManager");
        resolve(data);
      });
    });
  });
}
