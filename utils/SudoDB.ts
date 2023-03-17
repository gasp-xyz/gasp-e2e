/* eslint-disable no-loop-func */
/* eslint-disable no-console */
import { Guid } from "guid-typescript";
import { testLog } from "./Logger.js";
import { getCurrentNonce } from "./txHandler.js";
import { sleep } from "./utils.js";
import ipc from "node-ipc";
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
    )
      return await getCurrentNonce(sudoAddress);

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
}
async function getNonceFromIPC(): Promise<number> {
  return new Promise(function (resolve) {
    // const ipc = require("node-ipc").default;
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
