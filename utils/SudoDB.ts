import BN from "bn.js";
import { lockSudoFile, unlockSudoFile } from "./lock";
import { getChainNonce } from "./tx";
import { getCurrentNonce } from "./txHandler";
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
      process.env.VSCODE_INSPECTOR_OPTIONS.length > 0
    ) {
      return await getCurrentNonce(sudoAddress);
    }

    let dbNonce;
    if (process.argv.includes("--runInBand")) {
      return await getCurrentNonce(sudoAddress);
    }
    try {
      // we need to prevent workers accessing and writing to the file concurrently
      await lockSudoFile();
      const chainNonce: BN = await getChainNonce(sudoAddress);
      const chainNodeInt = parseInt(chainNonce.toString());

      //if does not exist, create it
      if (!fs.existsSync(this.sudoNonceFileName)) {
        fs.writeFileSync(this.sudoNonceFileName, "0");
      }
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

    return dbNonce;
  }
}
