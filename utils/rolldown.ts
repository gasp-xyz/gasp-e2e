import { getMangataInstance } from "./api";

export async function rolldownDeposit(
  lastProcessedRequestOnL1: number,
  lastAcceptedRequestOnL1: number,
  offsetValue: number,
  ethAddress: string,
  amountValue: number,
) {
  const mangata = await getMangataInstance();
  const sdkApi = await mangata.api();

  const extrinsic = sdkApi.tx.rolldown.updateL2FromL1({
    lastProccessedRequestOnL1: lastProcessedRequestOnL1,
    lastAcceptedRequestOnL1: lastAcceptedRequestOnL1,
    offset: offsetValue,
    order: sdkApi.createType("Vec<PalletRolldownMessagesPendingRequestType>", [
      "DEPOSIT",
    ]),
    pendingDeposits: sdkApi.createType("Vec<PalletRolldownMessagesDeposit>", [
      {
        depositRecipient: ethAddress,
        tokenAddress: ethAddress,
        amount: amountValue,
        blockHash: ethAddress + "000000000000000000000000",
      },
    ]),
  });
  return extrinsic;
}
