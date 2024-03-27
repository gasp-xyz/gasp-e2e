import { api, Extrinsic, getSudoUser, sudo } from "./setup";
import { User } from "./User";
import { MangataGenericEvent } from "@mangata-finance/sdk";
import { SudoDB } from "./SudoDB";
import { signSendFinalized } from "./sign";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import type { ISubmittableResult } from "@polkadot/types/types";
import { Call } from "@polkadot/types/interfaces";
import { signTxMetamask } from "./metamask";

export class Sudo {
  static sudo(
    tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  ): Extrinsic {
    return api.tx.sudo.sudo(tx as any as Call);
  }

  static sudoAs(user: User, tx: Extrinsic): Extrinsic {
    return api.tx.sudo.sudoAs(user.keyRingPair.address, tx as any as Call);
  }

  static sudoAsWithAddressString(address: string, tx: Extrinsic): Extrinsic {
    return api.tx.sudo.sudoAs(address, tx as any as Call);
  }

  static batch(...txs: Extrinsic[]): Extrinsic {
    return api.tx.utility.batchAll(txs as any as Call[]);
  }
  static singleBatch(...txs: Extrinsic[]): Extrinsic {
    return api.tx.utility.batch(txs as any as Call[]);
  }
  static forceBatch(...txs: Extrinsic[]): Extrinsic {
    return api.tx.utility.forceBatch(txs as any as Call[]);
  }

  static async batchAsSudoFinalized(
    ...txs: Extrinsic[]
  ): Promise<MangataGenericEvent[]> {
    const nonce = await SudoDB.getInstance().getSudoNonce(
      getSudoUser().ethAddress,
    );
    return signTxMetamask(
      api.tx.utility.batchAll(txs as any as Call[]),
      sudo.ethAddress,
      sudo.privateKey,
      { nonce: nonce },
    );
  }

  static async asSudoFinalized(tx: Extrinsic): Promise<MangataGenericEvent[]> {
    const nonce = await SudoDB.getInstance().getSudoNonce(
      sudo.keyRingPair.address,
    );
    return signSendFinalized(tx, sudo, nonce);
  }
}
