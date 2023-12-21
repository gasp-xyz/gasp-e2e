import { BN } from "@polkadot/util";
import { api } from "./setup";
import { User } from "./User";
import { BN_THOUSAND } from "@polkadot/util";
import { getBlockNumber } from "./utils";

export class Vesting {
  static async forceVested(
    fromUser: User | string,
    toUser: User | string,
    amount: BN,
    tokenId: BN,
    offset = 0,
  ) {
    const blockNo = await getBlockNumber();
    return api.tx.vesting.forceVestedTransfer(
      tokenId,
      fromUser.toString(),
      toUser.toString(),
      {
        locked: amount,
        perBlock: BN_THOUSAND,
        startingBlock: blockNo + offset,
      },
    );
  }
}
