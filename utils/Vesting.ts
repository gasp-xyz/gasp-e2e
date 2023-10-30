import { BN } from "@polkadot/util";
import { api } from "./setup";
import { User } from "./User";
import { BN_THOUSAND } from "@polkadot/util";
import { getBlockNumber } from "./utils";

export class Vesting {
  static async forceVested(
    fromUser: User,
    toUser: User,
    amount: BN,
    tokenId: BN,
  ) {
    const blockNo = await getBlockNumber();
    return api.tx.vesting.forceVestedTransfer(
      tokenId,
      fromUser.keyRingPair.address,
      toUser.keyRingPair.address,
      {
        locked: amount,
        perBlock: BN_THOUSAND,
        startingBlock: blockNo,
      },
    );
  }
}
