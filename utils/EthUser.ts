import Keyring from "@polkadot/keyring";
import { ethers } from "ethers";
import { randomBytes } from "crypto";
import { User } from "./User";
import { testLog } from "./Logger";

export class EthUser extends User {
  /**
   * class that represent the user with Ethereum wallet.
   */
  privateKey: string;
  ethAddress: string;

  constructor(keyring: Keyring, pKey?: string) {

    let privateKey: string;
    if (pKey) {
      privateKey = pKey;
    } else {
      privateKey = "0x" + randomBytes(32).toString("hex");
    }
    super(keyring, pKey);

    this.privateKey = privateKey;
    //@ts-ignore
    this.ethAddress = new ethers.Wallet(this.privateKey).address;

    testLog.getLog().info(
      `
      ******************************** 
         Created EthUser with:  
         eth address: ${this.ethAddress} 
                pkey: ${this.privateKey} 
         dot address: ${this.keyRingPair.address} 
      ******************************** `,
    );
  }
}
