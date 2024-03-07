import { hexToU8a } from "@polkadot/util";
import Keyring from "@polkadot/keyring";
import { ethers } from "ethers";
import { randomBytes } from "crypto";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import { User } from "./User";

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
//    this.privateKey =
//      "0xdc92c5a7649a10d6de3bec8109886010bd31a1cab338834609e24ccff517a7a6";

    //@ts-ignore
    this.ethAddress = new ethers.Wallet(this.privateKey).address;

    this.pdAccount = new User(keyring);
    this.pdAccount.addFromAddress(
      keyring,
      encodeAddress(blake2AsU8a(hexToU8a(this.ethAddress)), 42),
    );
  }
}
