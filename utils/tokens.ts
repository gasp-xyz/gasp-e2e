import { BN_HUNDRED } from "gasp-sdk";
import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";
import { User } from "./User";

export class Tokens {
  static transfer(dest: User, tokenId: BN, amount: BN = BN_HUNDRED): Extrinsic {
    return api.tx.tokens.transfer(dest.keyRingPair.address, tokenId, amount);
  }
}
