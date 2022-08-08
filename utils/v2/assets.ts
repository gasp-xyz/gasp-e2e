import { BN_HUNDRED, BN_TEN } from "@mangata-finance/sdk";
import { User } from "../User";
import { BN } from "@polkadot/util";
import { api, Extrinsic } from "./setup";
import { MGA_ASSET_ID } from "../Constants";
import { Sudo } from "./sudo";

export class Assets {
  static MG_UNIT: BN = BN_TEN.pow(new BN(18));

  static mintNative(
    user: User,
    amount: BN = BN_HUNDRED.mul(this.MG_UNIT)
  ): Extrinsic {
    user.addAsset(MGA_ASSET_ID);
    return Sudo.sudo(
      api.tx.tokens.mint(MGA_ASSET_ID, user.keyRingPair.address, amount)
    );
  }

  static issueToken(
    user: User,
    amount: BN = BN_HUNDRED.mul(this.MG_UNIT)
  ): Extrinsic {
    return Sudo.sudo(api.tx.tokens.create(user.keyRingPair.address, amount));
  }

  static mintToken(
    asset: BN,
    user: User,
    amount: BN = BN_HUNDRED.mul(this.MG_UNIT)
  ): Extrinsic {
    return Sudo.sudo(
      api.tx.tokens.mint(asset, user.keyRingPair.address, amount)
    );
  }

  static transfer(target: User, tokenId: BN, amount: BN): Extrinsic {
    return api.tx.tokens.transfer(target.keyRingPair.address, tokenId, amount);
  }

  static transferAll(target: User, tokenId: BN): Extrinsic {
    return api.tx.tokens.transferAll(target.keyRingPair.address, tokenId, true);
  }
}
