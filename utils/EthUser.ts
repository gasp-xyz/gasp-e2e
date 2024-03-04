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
  pdUser: User;

  constructor(keyring: Keyring) {
    const ethId = randomBytes(32).toString("hex");
    this.privateKey = "0x" + ethId;
    //@ts-ignore
    this.ethAddress = new ethers.Wallet(this.privateKey).address;

    this.pdUser = new User(keyring);
    this.pdUser.addFromAddress(
      keyring,
      encodeAddress(blake2AsU8a(hexToU8a(this.ethAddress)), 42),
    );
  }
}
