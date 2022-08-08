import { api, Extrinsic, sudo } from "./setup";
import { User } from "../User";
import { signSendFinalized } from "./event";

export class Sudo {
  static sudo(tx: Extrinsic): Extrinsic {
    return api.tx.sudo.sudo(tx);
  }

  static sudoAs(user: User, tx: Extrinsic): Extrinsic {
    return api.tx.sudo.sudoAs(user.keyRingPair.address, tx);
  }

  static batch(...txs: Extrinsic[]): Extrinsic {
    return api.tx.utility.batchAll(txs);
  }

  static async batchAsSudoFinalized(...txs: Extrinsic[]): Promise<void> {
    return signSendFinalized(api.tx.utility.batchAll(txs), sudo);
  }
}
