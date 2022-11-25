import { getApi } from "./api";
import { finalizeBootstrap } from "./tx";
import { ExtrinsicResult } from "./eventListeners";
import { User } from "./User";
import { getEventResultFromMangataTx, sudoIssueAsset } from "./txHandler";
import { BN, toBN } from "@mangata-finance/sdk";
import { Assets } from "./Assets";
import { setupApi } from "./setup";
import { Sudo } from "./sudo";

export async function checkLastBootstrapFinalized(sudoUser: User) {
  const api = getApi();
  await setupApi();

  let bootstrapPhase: any;

  // check that system is ready to bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const bootstrapFinalize = await finalizeBootstrap(sudoUser);
    const eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");
}

export async function createNewBootstrapCurrency(sudoUser: User) {
  const creatingBootstrapToken = await sudoIssueAsset(
    sudoUser.keyRingPair,
    toBN("1", 20),
    sudoUser.keyRingPair.address
  );
  const creatingBootstrapTokenResult = await getEventResultFromMangataTx(
    creatingBootstrapToken,
    ["tokens", "Issued", sudoUser.keyRingPair.address]
  );

  const bootstrapCurrencyId = new BN(
    creatingBootstrapTokenResult.data[0].split(",").join("")
  );

  return bootstrapCurrencyId;
}

export async function setupBootstrapTokensBalance(
  bootstrapTokenId: BN,
  sudoUser: User,
  testUser: User[]
) {
  const extrinsicCall = [
    Assets.mintNative(sudoUser),
    Assets.mintToken(bootstrapTokenId, sudoUser),
  ];
  testUser.forEach(async (userId) =>
    extrinsicCall.push(Assets.mintToken(bootstrapTokenId, userId))
  );
  testUser.forEach(async (userId) =>
    extrinsicCall.push(Assets.mintNative(userId))
  );
  await Sudo.batchAsSudoFinalized(...extrinsicCall);
}
