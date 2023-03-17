import { BN_HUNDRED } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup.js";
import { User } from "./User.js";

export class Tokens {
  static transfer(dest: User, tokenId: BN, amount: BN = BN_HUNDRED): Extrinsic {
    return api.tx.tokens.transfer(dest.keyRingPair.address, tokenId, amount);
  }
}
