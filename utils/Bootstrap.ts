/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { getApi } from "./api";
import { finalizeBootstrap } from "./tx";
import { EventResult, ExtrinsicResult } from "./eventListeners";
import { User } from "./User";
import { getEventResultFromMangataTx, sudoIssueAsset } from "./txHandler";
import { BN, toBN } from "@mangata-finance/sdk";
import { Assets } from "./Assets";
import { setupApi } from "./setup";
import { Sudo } from "./sudo";

export async function createNewBootstrapToken(sudoUser: User) {
  const api = getApi();
  await setupApi();

  let bootstrapPhase: any;
  let eventResponse: EventResult;

  // check that system is ready to bootstrap
  bootstrapPhase = await api.query.bootstrap.phase();
  if (bootstrapPhase.toString() === "Finished") {
    const bootstrapFinalize = await finalizeBootstrap(sudoUser);
    eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("BeforeStart");

  const issueNewBootstrapToken = await sudoIssueAsset(
    sudoUser.keyRingPair,
    toBN("1", 20),
    sudoUser.keyRingPair.address
  );
  const issueBootstrapTokenResult = await getEventResultFromMangataTx(
    issueNewBootstrapToken,
    ["tokens", "Issued", sudoUser.keyRingPair.address]
  );
  const bootstrapAssetId = issueBootstrapTokenResult.data[0]
    .split(",")
    .join("");
  const bootstrapTokenId = new BN(bootstrapAssetId);

  return bootstrapTokenId;
}

export async function setupBootstrapTokensBalance(
  bootstrapTokenId: BN,
  sudoUser: User,
  testUser1: User,
  testUser2 = testUser1
) {
  if ((testUser1 = testUser2)) {
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(bootstrapTokenId, testUser1),
      Assets.mintToken(bootstrapTokenId, sudoUser),
      Assets.mintNative(testUser1)
    );
  } else {
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(bootstrapTokenId, testUser1),
      Assets.mintToken(bootstrapTokenId, testUser2),
      Assets.mintToken(bootstrapTokenId, sudoUser),
      Assets.mintNative(testUser1),
      Assets.mintNative(testUser2)
    );
  }
}
