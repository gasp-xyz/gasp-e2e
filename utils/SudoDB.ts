import { BN } from "@polkadot/util";
import { env } from "process";
import { lockSudoFile, unlockSudoFile } from "./lock";
import { testLog } from "./Logger";
import { getChainNonce } from "./tx";
import { getUserNonceFromNode } from "./txHandler";
const fs = require("fs");

export class SudoDB {
  private sudoNonceFileName = "nonce.db";

  private static instance: SudoDB;

  // build the singleton.
  public static getInstance(): SudoDB {
    if (!SudoDB.instance) {
      SudoDB.instance = new SudoDB();
    }
    return SudoDB.instance;
  }

  public async getSudoNonce(sudoAddress: string) {
    //we are debugging, so we dont need sudo nonce.
    if (
      process.env.VSCODE_INSPECTOR_OPTIONS !== undefined &&
      process.env.VSCODE_INSPECTOR_OPTIONS.length > 0 &&
      process.env.PERF_TEST === undefined
    )
      return await getUserNonceFromNode(sudoAddress);

    let dbNonce;
    if (process.argv.includes("--runInBand")) {
      return await getUserNonceFromNode(sudoAddress);
    }
    try {
      // we need to prevent workers accessing and writing to the file concurrently
      await lockSudoFile();
      const chainNonce: BN = await getChainNonce(sudoAddress);
      const chainNodeInt = parseInt(chainNonce.toString());

      //if does not exist, create it
      if (!fs.existsSync(this.sudoNonceFileName))
        fs.writeFileSync(this.sudoNonceFileName, "0");
      dbNonce = fs.readFileSync(this.sudoNonceFileName, {
        encoding: "utf8",
        flag: "r",
      });

      if (dbNonce === undefined || chainNodeInt > parseInt(dbNonce)) {
        dbNonce = chainNodeInt;
      }
      const nextNonce = parseInt(dbNonce) + 1;

      fs.writeFileSync(this.sudoNonceFileName, String(nextNonce));
    } finally {
      //unlock always!
      unlockSudoFile();
    }
    testLog.getLog().info(`W[${env.JEST_WORKER_ID}] - sudoNonce: ${dbNonce} `);
    return dbNonce;
  }
}
