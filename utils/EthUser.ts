import { hexToU8a } from "@polkadot/util";
import Keyring from "@polkadot/keyring";
import { ethers } from "ethers";
import { randomBytes } from "crypto";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import { User } from "./User";
import { testLog } from "./Logger";

export class EthUser extends User {
  /**
   * class that represent the user with Ethereum wallet.
   */
  privateKey: string;
  ethAddress: string;

  constructor(keyring: Keyring, pKey?: string) {
    super(keyring);
    let privateKey: string;
    if (pKey) {
      privateKey = pKey;
    } else {
      privateKey = "0x" + randomBytes(32).toString("hex");
    }

    this.privateKey = privateKey;
    //@ts-ignore
    this.ethAddress = new ethers.Wallet(this.privateKey).address;
    const pdAccount = new User(keyring);
    pdAccount.addFromAddress(
      keyring,
      encodeAddress(blake2AsU8a(hexToU8a(this.ethAddress)), 42),
    );
    this.keyRingPair = pdAccount.keyRingPair;
    this.name = pdAccount.name;
    this.keyring = pdAccount.keyring;
    this.assets = pdAccount.assets;

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
