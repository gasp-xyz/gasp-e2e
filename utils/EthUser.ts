import { hexToU8a } from "@polkadot/util";
import Keyring from "@polkadot/keyring";
import { ethers } from "ethers";
import { randomBytes } from "crypto";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import { User } from "./User";
import { testLog } from "./Logger";

export class EthUser {
  /**
   * class that represent the user with Ethereum wallet.
   */
  privateKey: string;
  ethAddress: string;
  pdAccount: User;

  constructor(keyring: Keyring) {
    const ethId = randomBytes(32).toString("hex");
    console.log(ethId);
    this.privateKey = "0x" + ethId;
    
    //@ts-ignore
    this.ethAddress = new ethers.Wallet(this.privateKey).address;

    this.pdAccount = new User(keyring);
    this.pdAccount.addFromAddress(
      keyring,
      encodeAddress(blake2AsU8a(hexToU8a(this.ethAddress)), 42),
    );
    testLog.getLog().info(
      `******************************** 
         Created EthUser with:  
         eth address: ${this.ethAddress} 
                pkey: ${this.privateKey} 
         dot address: ${this.pdAccount.keyRingPair.address} 
        ******************************** `,
    );
  }
}
