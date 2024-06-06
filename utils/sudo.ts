import { api, Extrinsic, sudo } from "./setup";
import { User } from "./User";
import { BN_ZERO, MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { SudoDB } from "./SudoDB";
import { signSendFinalized } from "./sign";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import type { ISubmittableResult } from "@polkadot/types/types";
import { Call } from "@polkadot/types/interfaces";
import { getApi } from "./api";
import { BN } from "@polkadot/util";
import { stringToBN } from "./utils";

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
      sudo.keyRingPair.address,
    );
    return Sudo.batchAsSudoFinalizedNonce(nonce, ...txs);
  }

  static async asSudoFinalized(tx: Extrinsic): Promise<MangataGenericEvent[]> {
    const nonce = await SudoDB.getInstance().getSudoNonce(
      sudo.keyRingPair.address,
    );
    return signSendFinalized(tx, sudo, nonce);
  }

  static async batchAsSudoFinalizedNonce(sudoNonce: BN, ...txs: Extrinsic[]) {
    const api = getApi();
    let nonce = sudoNonce;
    if (stringToBN(sudoNonce.toString()).lt(BN_ZERO)) {
      nonce = await SudoDB.getInstance().getSudoNonce(sudo.keyRingPair.address);
    }
    return signTx(
      api,
      api.tx.utility.batchAll(txs as any as Call[]),
      sudo.keyRingPair,
      { nonce: nonce },
    );
  }
}
