import { api, Extrinsic, sudo } from "./setup";
import { User } from "./User";
import { MangataGenericEvent } from "@mangata-finance/sdk";
import { SudoDB } from "./SudoDB";
import { signSendFinalized } from "./eventListeners";

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
