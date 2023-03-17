import { api, Extrinsic, sudo } from "./setup.js";
import { User } from "./User.js";
import { MangataGenericEvent } from "@mangata-finance/sdk";
import { SudoDB } from "./SudoDB.js";
import { signSendFinalized } from "./sign.js";

export class Sudo {
  static sudo(tx: Extrinsic): Extrinsic {
    return api.tx.sudo.sudo(tx);
  }

  static sudoAs(user: User, tx: Extrinsic): Extrinsic {
    return api.tx.sudo.sudoAs(user.keyRingPair.address, tx);
  }

  static sudoAsWithAddressString(address: string, tx: Extrinsic): Extrinsic {
    return api.tx.sudo.sudoAs(address, tx);
  }

  static batch(...txs: Extrinsic[]): Extrinsic {
    return api.tx.utility.batchAll(txs);
  }
  static singleBatch(...txs: Extrinsic[]): Extrinsic {
    return api.tx.utility.batch(txs);
  }
  static forceBatch(...txs: Extrinsic[]): Extrinsic {
    return api.tx.utility.forceBatch(txs);
  }

  static async batchAsSudoFinalized(
    ...txs: Extrinsic[]
  ): Promise<MangataGenericEvent[]> {
    const nonce = await SudoDB.getInstance().getSudoNonce(
      sudo.keyRingPair.address
    );
    return signSendFinalized(api.tx.utility.batchAll(txs), sudo, nonce);
  }

  static async asSudoFinalized(tx: Extrinsic): Promise<MangataGenericEvent[]> {
    const nonce = await SudoDB.getInstance().getSudoNonce(
      sudo.keyRingPair.address
    );
    return signSendFinalized(tx, sudo, nonce);
  }
}
