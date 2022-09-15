import {
  MangataGenericEvent,
  signTx as signsdk,
  TxOptions,
} from "@mangata-finance/sdk";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { ApiPromise } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { retry } from "utils-decorators";
import { testLog } from "./Logger";

class TxRetry {
  @retry({
    retries: 2,
    delay: 1500,
    onRetry: (e, retriesCount) =>
      testLog
        .getLog()
        .warn(`TX_ERROR: Attempt: ${retriesCount}: Error ${e.message} `),
  })
  static async signTx(
    api: ApiPromise,
    tx: SubmittableExtrinsic<"promise">,
    account: string | KeyringPair,
    txOptions?: TxOptions
  ): Promise<MangataGenericEvent[]> {
    return signsdk(api, tx, account, txOptions);
  }
}

export default function signTx(
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  account: string | KeyringPair,
  txOptions?: TxOptions
): Promise<MangataGenericEvent[]> {
  return TxRetry.signTx(api, tx, account, txOptions);
}
