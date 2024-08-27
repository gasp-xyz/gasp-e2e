import Keyring from "@polkadot/keyring";
import { ethers } from "ethers";
import { randomBytes } from "crypto";
import { User } from "./User";
import { testLog } from "./Logger";
import { getApi } from "./api";
import { api } from "./setup";
import { OrmlTokensAccountData } from "@polkadot/types/lookup";

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

    testLog.getLog().debug(
      `
      ******************************** 
         Created EthUser with:  
         eth address: ${this.ethAddress} 
                pkey: ${this.privateKey} 
         dot address: ${this.keyRingPair.address} 
      ******************************** `,
    );
  }

  async getBalanceForEthToken(address: string) {
    const tokenId = await getApi().query.assetRegistry.l1AssetToId({
      Ethereum: address,
    });
    if (tokenId.isNone) {
      return api.createType("OrmlTokensAccountData", {
        free: 0,
        reserved: 0,
        frozen: 0,
      }) as OrmlTokensAccountData;
    }
    return await getApi().query.tokens.accounts(
      this.keyRingPair.address,
      tokenId.toString(),
    );
  }
}
