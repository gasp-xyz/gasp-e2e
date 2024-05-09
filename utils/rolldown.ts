import { getMangataInstance } from "./api";
import { EthUser } from "./EthUser";
import { User } from "./User";
import BN from "bn.js";

export async function rolldownDeposit(
  requestNumber: number,
  ethAddress: string,
  amountValue: number,
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();

  return sdkApi.tx.rolldown.updateL2FromL1({
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

export async function rolldownWithdraw(
  EthUser: EthUser | User,
  amountValue: BN | number,
  tokenAddress: string = "",
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();
  const address = tokenAddress === "" ? EthUser.toString() : tokenAddress;

  return sdkApi.tx.rolldown.withdraw(
    EthUser.toString(),
    address,
    amountValue,
  );
}

export class RollDown {
  static async cancelRequestsFromL1(requestNumber: number, force: boolean) {
    const mangata = await getMangataInstance();
    const sdkApi = await mangata.api();
    if (force) {
      return sdkApi.tx.rolldown.forceCancelRequestsFromL1(requestNumber);
    }
    return sdkApi.tx.rolldown.cancelRequestsFromL1(requestNumber);
  }
  static async withdraw(
    EthUser: EthUser | User,
    amountValue: BN | number,
    tokenAddress: string = "",
  ) {
    return rolldownWithdraw(EthUser, amountValue, tokenAddress);
  }
  static async deposit(
    requestNumber: number,
    ethAddress: string,
    amountValue: number,
  ) {
    return rolldownDeposit(requestNumber, ethAddress, amountValue);
  }
}
