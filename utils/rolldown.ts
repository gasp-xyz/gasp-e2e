import { EthUser } from "./EthUser";
import { getMangataInstance } from "./api";

export async function rolldownDeposit(
  lastProccessedRequestOnL1: number,
  lastAcceptedRequestOnL1: number,
  offsetValue: number,
  user: EthUser,
  amountValue: number,
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();

  const extrinsic = sdkApi.tx.rolldown.updateL2FromL1({
    lastProccessedRequestOnL1: lastProccessedRequestOnL1,
    lastAcceptedRequestOnL1: lastAcceptedRequestOnL1,
    offset: offsetValue,
    order: sdkApi.createType("Vec<PalletRolldownMessagesPendingRequestType>", [
      "DEPOSIT",
    ]),
    pendingDeposits: sdkApi.createType("Vec<PalletRolldownMessagesDeposit>", [
      {
        depositRecipient: user.ethAddress,
        tokenAddress: user.ethAddress,
        amount: amountValue,
        blockHash: user.ethAddress + "000000000000000000000000",
      },
    ]),
  });
  return extrinsic;
}
