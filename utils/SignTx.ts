import { signTx, MangataGenericEvent, TxOptions } from "@mangata-finance/sdk";
import { signTxAndGetEvents } from "./txHandler";
import { ApiPromise } from "@polkadot/api";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { KeyringPair } from "@polkadot/keyring/types";

let signTxToExport: (
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  account: string | KeyringPair,
  txOptions?: TxOptions
) => Promise<MangataGenericEvent[]>;

if (process.env.CHOPSTICK_ENABLED) {
  signTxToExport = signTxAndGetEvents;
} else {
  signTxToExport = signTx;
}
export { signTxToExport as signTx };
