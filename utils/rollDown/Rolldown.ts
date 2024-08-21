import { setupUsers } from "../setup";
import { getApi } from "../api";
import { EthUser } from "../EthUser";
import { BN } from "@polkadot/util";
import { BN_MILLION, BN_ZERO, MangataGenericEvent, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../txHandler";
import { stringToBN, waitBlockNumber } from "../utils";
import {
  findEventData,
  getEventsAt,
  waitNewBlock,
  waitSudoOperationSuccess,
} from "../eventListeners";
import { ApiPromise } from "@polkadot/api";
import { ChainName, SequencerStaking } from "./SequencerStaking";
import { testLog } from "../Logger";
import { BTreeMap } from "@polkadot/types-codec";
import {
  PalletRolldownSequencerRights,
  SpRuntimeAccountAccountId20,
} from "@polkadot/types/lookup";
import { User } from "../User";
import { Sudo } from "../sudo";
import { getAssetIdFromErc20 } from "../rollup/ethUtils";
import { getL1FromName } from "../rollup/l1s";

export class Rolldown {
  static async lastProcessedRequestOnL2(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.lastProcessedRequestOnL2(l1);
    return parseInt(requestId.toString()) + 1;
  }
  static async maxAcceptedRequestIdOnl2(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.maxAcceptedRequestIdOnl2(l1);
    return parseInt(requestId.toString());
  }
  static isDepositSucceed(
    events: MangataGenericEvent[],
    userAddress: string,
    amount: BN,
  ) {
    return events.some(
      (x) =>
        x.phase.toString() === "Initialization" &&
        x.event.method === "Deposited" &&
        x.event.section === "tokens" &&
        JSON.stringify(x.event.data).includes(userAddress.toLowerCase()) &&
        Object.hasOwn(x.event.data, "amount") &&
        stringToBN(
          // @ts-ignore : it's secure to access the amount property
          x.event.data["amount"].toString(),
        ).eq(amount),
    );
  }
  static async untilL2Processed(txResult: MangataGenericEvent[]) {
    const until = getEventResultFromMangataTx(txResult, [
      "rolldown",
      "L1ReadStored",
    ]);
    const blockNo = stringToBN(until.data[0][2]);
    await waitBlockNumber(blockNo.toString(), 10);
    let events = await getEventsAt(blockNo);
    if (!Rolldown.hasL2Processed(events as any[] as MangataGenericEvent[])) {
      //wait one block because of the session change.
      await waitNewBlock();
      events = await getEventsAt(blockNo.addn(1));
    }
    return events as any[] as MangataGenericEvent[];
  }
  static hasL2Processed(events: MangataGenericEvent[]) {
    return events.some((x) => {
      return (
        x.event.section === "rolldown" &&
        x.event.method === "RequestProcessedOnL2"
      );
    });
  }
  static async deposit(
    user: EthUser,
    requestIdx: number,
    ethAddress: string,
    amount: BN,
  ) {
    const tx = new L2Update(getApi())
      .withDeposit(requestIdx, ethAddress, ethAddress, amount.toNumber())
      .build();
    const api = getApi();
    return await signTx(api, tx, user.keyRingPair);
  }

  static async waitForReadRights(
    userAddress: string,
    maxBlocks = 61,
    chain: ChainName = "Ethereum",
  ) {
    while (maxBlocks-- > 0) {
      testLog
        .getLog()
        .info(
          `Waiting for read rights ${maxBlocks} : ${chain} : ${userAddress}`,
        );
      const seqRights = await getApi().query.rolldown.sequencersRights(chain);
      testLog.getLog().info(JSON.stringify(seqRights.toHuman()));
      const selectedSequencer =
        await getApi().query.sequencerStaking.selectedSequencer();
      testLog.getLog().info(JSON.stringify(selectedSequencer.toHuman()));
      const isSelectedSeq = Object.values(selectedSequencer.toHuman()).includes(
        userAddress,
      );
      const reads =
        (seqRights.toHuman()[userAddress] as any) !== undefined &&
        (seqRights.toHuman()[userAddress] as any).readRights;
      if (reads && parseInt(reads) > 0 && isSelectedSeq) {
        return;
      } else {
        await waitNewBlock();
      }
    }
    throw new Error("Max blocks reached without getting read rights");
  }

  static async disputePeriodLength() {
    const api = getApi();
    return (await api.consts.rolldown.disputePeriodLength) as any as BN;
  }

  static async cancelRequestFromL1(chainId: ChainName, reqId: number) {
    const api = getApi();
    return api.tx.rolldown.cancelRequestsFromL1(chainId, reqId);
  }

  static getRequestIdFromEvents(
    events: MangataGenericEvent[],
    module = "rolldown",
    method = "L1ReadStored",
  ) {
    const event = getEventResultFromMangataTx(events, [module, method]);
    return stringToBN(event.data[0][2].toString()).toNumber();
  }
  static getRequestIdFromCancelEvent(
    cancel: MangataGenericEvent[],
    rolldown: string = "rolldown",
    l1ReadCanceled: string = "L1ReadCanceled",
  ) {
    const event = getEventResultFromMangataTx(cancel, [
      rolldown,
      l1ReadCanceled,
    ]);
    // @ts-ignore
    return stringToBN(event.data.assignedId.id).toNumber();
  }

  static async sequencerRights(chain: string, seqAddress: string) {
    const api = getApi();
    const rights = (await api.query.rolldown.sequencersRights(
      chain,
    )) as any as unknown as BTreeMap<
      SpRuntimeAccountAccountId20,
      PalletRolldownSequencerRights
    >;
    testLog.getLog().info(`Rights : ${rights.toJSON()}`);
    return api.createType(
      "PalletRolldownSequencerRights",
      rights.toJSON()[seqAddress],
    ) as any as PalletRolldownSequencerRights;
  }

  static async isTokenBalanceIncreased(
    tokenAddress: string,
    chain: any,
    gt: BN = BN_ZERO,
  ) {
    const api = getApi();
    const l1 = getL1FromName(chain)!;
    const assetId = await getAssetIdFromErc20(tokenAddress, l1);
    if (assetId.lte(BN_ZERO)) {
      return false;
    } else {
      const balance = await api.query.tokens.accounts(tokenAddress, assetId);
      return balance.free.toBn().gt(gt);
    }
  }

  static async wasAssetRegistered(executionBlockNumber: number) {
    const api = getApi();
    const blockHash = await api.rpc.chain.getBlockHash(executionBlockNumber);
    const events = await api.query.system.events.at(blockHash);
    const filteredEvent = events.filter(
      (result: any) => result.event.method === "RegisteredAsset",
    );
    return filteredEvent[0] !== undefined;
  }

  static async getRegisteredAssetId(executionBlockNumber: number) {
    const api = getApi();
    const blockHash = await api.rpc.chain.getBlockHash(executionBlockNumber);
    const events = await api.query.system.events.at(blockHash);
    const filteredEvent = events.filter(
      (result: any) => result.event.method === "RegisteredAsset",
    );
    // @ts-ignore
    const assetId = new BN(filteredEvent[0].event.data.assetId.toString());
    return assetId;
  }
}
export class L2Update {
  api: ApiPromise;
  pendingDeposits: any[];
  pendingWithdrawalResolutions: any[];
  pendingCancelResolutions: any[];
  pendingL2UpdatesToRemove: any[];
  chain: string = "Ethereum";

  constructor(api: ApiPromise) {
    this.api = api;
    this.pendingDeposits = this.api.createType(
      "Vec<PalletRolldownMessagesDeposit>",
    );
    this.pendingWithdrawalResolutions = this.api.createType(
      "Vec<PalletRolldownMessagesWithdrawalResolution>",
    );
    this.pendingCancelResolutions = this.api.createType(
      "Vec<PalletRolldownMessagesCancelResolution>",
    );
    this.pendingL2UpdatesToRemove = this.api.createType(
      "Vec<PalletRolldownMessagesL2UpdatesToRemove>",
    );
  }

  build() {
    return this.api.tx.rolldown.updateL2FromL1(this.buildParams());
  }
  forceBuild() {
    return this.api.tx.rolldown.forceUpdateL2FromL1(this.buildParams());
  }

  private buildParams() {
    return {
      chain: this.api.createType("PalletRolldownMessagesChain", this.chain),
      pendingDeposits: this.api.createType(
        "Vec<PalletRolldownMessagesDeposit>",
        this.pendingDeposits,
      ),
      pendingCancelResolutions: this.api.createType(
        "Vec<PalletRolldownMessagesCancelResolution>",
        this.pendingCancelResolutions,
      ),
      // @ts-ignore
      pendingWithdrawalResolutions: this.api.createType(
        "Vec<PalletRolldownMessagesWithdrawalResolution>",
        this.pendingWithdrawalResolutions,
      ),
      pendingL2UpdatesToRemove: this.api.createType(
        "Vec<PalletRolldownMessagesL2UpdatesToRemove>",
        this.pendingL2UpdatesToRemove,
      ),
    };
  }

  clone(fromIndex: number, number: number) {
    let index = fromIndex;
    this.pendingDeposits.forEach((x) => {
      for (let i = 0; i < number; i++) {
        index++;
        this.withDeposit(index, x.depositRecipient, x.tokenAddress, x.amount);
      }
    });
    this.pendingL2UpdatesToRemove.forEach((x) => {
      for (let i = 0; i < number; i++) {
        index++;
        this.withUpdatesToRemove(index, x.updatesToRemove);
      }
    });
    this.pendingCancelResolutions.forEach((x) => {
      for (let i = 0; i < number; i++) {
        index++;
        this.withCancelResolution(index, x.l2RequestId, x.cancelJustified);
      }
    });
    this.pendingWithdrawalResolutions.forEach((x) => {
      for (let i = 0; i < number; i++) {
        index++;
        this.withWithdraw(index, x.txIndex, x.status);
      }
    });

    return this;
  }
  on(chainName = "Ethereum") {
    this.chain = chainName;
    return this;
  }
  withDeposit(
    txIndex: number,
    ethAddress: string,
    erc20Address: string,
    amountValue: number | BN,
    timestamp: number = Date.now(),
  ) {
    const deposit = this.api.createType("PalletRolldownMessagesDeposit", {
      requestId: this.api.createType("PalletRolldownMessagesRequestId", [
        "L1",
        txIndex,
      ]),
      depositRecipient: ethAddress,
      tokenAddress: erc20Address,
      amount: amountValue,
      timeStamp: timestamp,
    });
    this.pendingDeposits.push(deposit);
    return this;
  }

  withWithdraw(
    txIndex: number,
    txIndexForL2Request: number,
    status: boolean,
    timestamp: number = Date.now(),
  ) {
    const withdraw = this.api.createType(
      "PalletRolldownMessagesWithdrawalResolution",
      {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        l2RequestId: txIndexForL2Request,
        status: status,
        timeStamp: timestamp,
      },
    );
    this.pendingWithdrawalResolutions.push(withdraw);
    return this;
  }
  withCancelResolution(
    txIndex: number,
    l2RequestId: number,
    cancelJustified: boolean,
    timestamp: number = Date.now(),
  ) {
    const cancelResolution = this.api.createType(
      "PalletRolldownMessagesCancelResolution",
      {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        l2RequestId: l2RequestId,
        cancelJustified: cancelJustified,
        timeStamp: timestamp,
      },
    );
    this.pendingCancelResolutions.push(cancelResolution);
    return this;
  }
  withUpdatesToRemove(
    txIndex: number,
    updatesToRemove: number[],
    timestamp: number = Date.now(),
  ) {
    const updateToRemove = this.api.createType(
      "PalletRolldownMessagesL2UpdatesToRemove",
      {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        l2UpdatesToRemove: this.api.createType("Vec<u128>", updatesToRemove),
        timeStamp: timestamp,
      },
    );
    this.pendingL2UpdatesToRemove.push(updateToRemove);
    return this;
  }
}

export async function createAnUpdate(
  seq: User | string,
  chain: ChainName = "Arbitrum",
  forcedIndex = 0,
  updateValue: any = null,
  depositAmountValue = BN_MILLION,
) {
  const address = typeof seq === "string" ? seq : seq.keyRingPair.address;
  await Rolldown.waitForReadRights(address, 50, chain);
  let txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  if (forcedIndex !== 0) {
    txIndex = forcedIndex;
  }
  const api = getApi();
  let update: any;
  if (updateValue === null) {
    update = new L2Update(api)
      .withDeposit(txIndex, address, address, depositAmountValue)
      .on(chain)
      .build();
  } else {
    update = updateValue;
  }
  let reqId = 0;
  let executionBlockNumber: any;
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(address, update),
  ).then(async (events) => {
    executionBlockNumber = findEventData(events, "rolldown.L1ReadStored")[0][2]
      .toString()
      .replaceAll(",", "");
    await waitSudoOperationSuccess(events, "SudoAsDone");
    reqId = Rolldown.getRequestIdFromEvents(events);
  });
  return { txIndex, api, reqId, executionBlockNumber };
}

export async function createAnUpdateAndCancelIt(
  seq: User,
  cancelerAddress: string,
  chain: ChainName = "Arbitrum",
  updateValue: any = null,
  forcedIndex = 0,
) {
  const { txIndex, api, reqId, executionBlockNumber } = await createAnUpdate(
    seq,
    chain,
    forcedIndex,
    updateValue,
  );
  const cancel = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      cancelerAddress,
      await Rolldown.cancelRequestFromL1(chain, reqId),
    ),
  );
  await waitSudoOperationSuccess(cancel, "SudoAsDone");
  const reqIdCanceled = Rolldown.getRequestIdFromCancelEvent(cancel);
  return { txIndex, api, reqId, reqIdCanceled, executionBlockNumber };
}

export async function leaveSequencing(userAddr: string) {
  const stakedEth = await SequencerStaking.sequencerStake(userAddr, "Ethereum");
  const stakedArb = await SequencerStaking.sequencerStake(userAddr, "Arbitrum");
  let chain = "";
  if (stakedEth.toHuman() !== "0") {
    chain = "Ethereum";
  } else if (stakedArb.toHuman() !== "0") {
    chain = "Arbitrum";
  }
  if (chain !== "") {
    await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        userAddr,
        await SequencerStaking.leaveSequencerStaking(chain as ChainName),
      ),
    );
    await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        userAddr,
        await SequencerStaking.unstake(chain as ChainName),
      ),
    );
  }
}
