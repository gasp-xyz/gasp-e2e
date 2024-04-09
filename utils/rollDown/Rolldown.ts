import { setupUsers } from "../setup";
import { getApi } from "../api";
import { EthUser } from "../EthUser";
import { BN } from "@polkadot/util";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../txHandler";
import { stringToBN, waitBlockNumber } from "../utils";
import { getEventsAt } from "../eventListeners";
import { ApiPromise } from "@polkadot/api";

export class Rolldown {

  static async l2OriginRequestId(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.l2OriginRequestId(l1);
    return requestId as any as number;
  }
  static async lastProcessedRequestOnL2(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.lastProcessedRequestOnL2(l1);
    return requestId as any as number;
  }

  static async untilL2Processed(txResult: MangataGenericEvent[]) {
    const until = getEventResultFromMangataTx(txResult, ["rolldown", "L1ReadStored"]);
    const blockNo = stringToBN(until.data[0][1]);
    await waitBlockNumber(blockNo.toString(), 10);
    const events = await getEventsAt(blockNo);
    return events as any[] as MangataGenericEvent[];
  }
  static async deposit(user : EthUser, requestIdx: number, ethAddress: string, amount: BN) {
    const tx =
      new L2Update(getApi())
        .withDeposit(requestIdx, ethAddress, ethAddress, amount.toNumber())
        .build();
    const api = getApi();
    return await signTx(api, tx, user.keyRingPair);
  }

}
export class L2Update {
  api: ApiPromise;
  pendingDeposits: any[];
  constructor(api: ApiPromise) {
    this.api = api
    this.pendingDeposits = this.api.createType("Vec<PalletRolldownMessagesDeposit>");
  }

  build(){
    return this.api.tx.rolldown.updateL2FromL1({
      pendingDeposits: this.api.createType("Vec<PalletRolldownMessagesDeposit>",  this.pendingDeposits),
    });
  }
  withDeposit(txIndex: number, ethAddress: string, erc20Address: string, amountValue: number) {
    const deposit =  this.api.createType("PalletRolldownMessagesDeposit",  {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        depositRecipient: ethAddress,
        tokenAddress: erc20Address,
        amount: amountValue,
        blockHash: ethAddress + "000000000000000000000000",
      });
    this.pendingDeposits.push(deposit);
    return this;
  }
}