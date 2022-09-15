import {
  BN,
  MangataGenericEvent,
  signTx as signsdk,
  TxOptions,
} from "@mangata-finance/sdk";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { retry } from "utils-decorators";
import { testLog } from "./Logger";
import { getCurrentNonce } from "./tx";

class TxRetry {
  nonce = new BN(0);
  @retry({
    retries: 2,
    delay: 1500,
    onRetry: (e, retriesCount) => {
      testLog
        .getLog()
        .warn(`TX_ERROR: Attempt: ${retriesCount}: Error ${e.message} `);
    },
  })
  async signTx(
    api: ApiPromise,
    tx: SubmittableExtrinsic<"promise">,
    account: string | KeyringPair,
    txOptions?: TxOptions
  ): Promise<MangataGenericEvent[]> {
    if (this.nonce.gtn(0)) {
      txOptions!.nonce = await getCurrentNonce(
        (account as KeyringPair).address
      );
      testLog
        .getLog()
        .warn(`TX_ERROR: new nonce! : ${txOptions!.nonce.toString()} `);
    }
    if (txOptions && txOptions?.nonce) {
      this.nonce = txOptions.nonce;
      testLog.getLog().info(`Storing nonce: ${txOptions!.nonce.toString()} `);
    }
    return signsdk(api, tx, account, txOptions);
  }
}

export default function signTx(
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  account: string | KeyringPair,
  txOptions?: TxOptions
): Promise<MangataGenericEvent[]> {
  return new TxRetry().signTx(api, tx, account, txOptions);
}
