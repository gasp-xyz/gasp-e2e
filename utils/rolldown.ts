import { getMangataInstance } from "./api";
import { EthUser } from "./EthUser";
import { User } from "./User";
import BN from "bn.js";
import { ChainName } from "./rollDown/SequencerStaking";

export async function rolldownDeposit(
  requestNumber: number,
  ethAddress: string,
  amountValue: number,
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();

  return sdkApi.tx.rolldown.updateL2FromL1Unsafe({
    pendingDeposits: sdkApi.createType("Vec<PalletRolldownMessagesDeposit>", [
      {
        requestId: sdkApi.createType("PalletRolldownMessagesRequestId", [
          "L1",
          requestNumber,
        ]),
        depositRecipient: ethAddress,
        tokenAddress: ethAddress,
        amount: amountValue,
        blockHash: ethAddress + "000000000000000000000000",
      },
    ]),
  });
}

export async function getLastProcessedRequestNumber() {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();

  const value = JSON.parse(
    JSON.stringify(
      await sdkApi.query.rolldown.lastProcessedRequestOnL2("Ethereum"),
    ),
  );
  return +value;
}

export async function Withdraw(
  EthUser: EthUser | User,
  amountValue: BN | number,
  tokenAddress: string = "",
  chain: ChainName = "Ethereum",
  ferryTip: BN | null = null,
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();
  const address = tokenAddress === "" ? EthUser.toString() : tokenAddress;

  return sdkApi.tx.rolldown.withdraw(
    chain,
    EthUser.toString(),
    address,
    amountValue,
    ferryTip,
  );
}

export class RollDown {
  static async cancelRequestsFromL1(
    requestNumber: number,
    force: boolean,
    chain: ChainName = "Ethereum",
  ) {
    const mangata = await getMangataInstance();
    const sdkApi = await mangata.api();
    if (force) {
      return sdkApi.tx.rolldown.forceCancelRequestsFromL1(chain, requestNumber);
    }
    return sdkApi.tx.rolldown.cancelRequestsFromL1(chain, requestNumber);
  }
}
