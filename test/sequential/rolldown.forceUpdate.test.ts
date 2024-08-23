/*
 *
 * @group sequencerStaking
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import {
  L2Update,
  Rolldown,
  createAnUpdate,
  leaveSequencing,
} from "../../utils/rollDown/Rolldown";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { BN_MILLION, signTx } from "gasp-sdk";
import {
  ExtrinsicResult,
  findEventData,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { isBadOriginError, waitForNBlocks } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { GASP_ASSET_ID } from "../../utils/Constants";

let api: any;
let testUser: User;
let testUserAddress: string;
const preSetupSequencers = {
  Ethereum: "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
  Arbitrum: "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc",
};
let chain: any;

async function setupASequencer(user: User, chain: ChainName = "Ethereum") {
  const extrinsic = await SequencerStaking.provideSequencerStaking(
    (await SequencerStaking.minimalStakeAmount()).addn(1000),
    chain,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(user),
    Sudo.sudoAs(user, extrinsic),
  );
}

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  api = getApi();
  chain = "Ethereum";
});

beforeEach(async () => {
  //TODO: Replace this by some monitoring of the active queue.
  await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
  const activeSequencers = await SequencerStaking.activeSequencers();
  let anysequencerGone = false;
  for (const chain in activeSequencers.toHuman()) {
    for (const seq of activeSequencers.toHuman()[chain] as string[]) {
      if (
        seq !== preSetupSequencers.Ethereum &&
        seq !== preSetupSequencers.Arbitrum
      ) {
        await leaveSequencing(seq);
        anysequencerGone = true;
      }
    }
  }
  if (anysequencerGone) {
    await waitForNBlocks(10);
  }
  [testUser] = setupUsers();
  testUserAddress = testUser.keyRingPair.address;
});

it("forceUpdateL2FromL1 can be called by Sudo", async () => {
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on(chain)
    .forceBuild();
  await Sudo.asSudoFinalized(Sudo.sudo(update)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});

it("forceUpdateL2FromL1 can't be called by non-sudo user", async () => {
  await setupASequencer(testUser, chain);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on(chain)
    .forceBuild();
  await signTx(api, update, testUser.keyRingPair).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    const isBadOrigin = isBadOriginError(events);
    expect(isBadOrigin).toEqual(true);
  });
});

it("Validate that forceCancelRequestsFromL1 can be called by Sudo", async () => {
  await setupASequencer(testUser, chain);
  const { reqId } = await createAnUpdate(testUser, chain);
  const cancel = await Rolldown.forceCancelRequestFromL1(chain, reqId);
  await Sudo.asSudoFinalized(Sudo.sudo(cancel)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});

it("Validate that forceCancelRequestsFromL1 can't be called by non-sudo user", async () => {
  await setupASequencer(testUser, chain);
  const { reqId } = await createAnUpdate(testUser, chain);
  const cancel = await Rolldown.forceCancelRequestFromL1(chain, reqId);
  await signTx(api, cancel, testUser.keyRingPair).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    const isBadOrigin = isBadOriginError(events);
    expect(isBadOrigin).toEqual(true);
  });
});

it("forceUpdateL2FromL1 does not wait for a dispute period", async () => {
  let assetId: any;
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on(chain)
    .forceBuild();
  await Sudo.asSudoFinalized(Sudo.sudo(update)).then(async (events) => {
    await waitSudoOperationSuccess(events);
    assetId = findEventData(events, "assetRegistry.RegisteredAsset")
      .assetId.toString()
      .replaceAll(",", "");
  });
  testUser.addAsset(assetId);
  await testUser.refreshAmounts(AssetWallet.AFTER);
  expect(testUser.getAsset(assetId)?.amountAfter.free!).bnEqual(BN_MILLION);
});

it("forceCancelRequest does not need any resolution to justify the cancelation", async () => {
  testUser.addAsset(GASP_ASSET_ID);
  await setupASequencer(testUser, chain);
  await testUser.refreshAmounts(AssetWallet.BEFORE);
  const { reqId } = await createAnUpdate(testUser, chain);
  const cancel = await Rolldown.forceCancelRequestFromL1(chain, reqId);
  await Sudo.asSudoFinalized(Sudo.sudo(cancel)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
  const cancelResolution = await Rolldown.waitCancelResolution(testUser, chain);
  expect(cancelResolution[0]).toBe(undefined);
  await testUser.refreshAmounts(AssetWallet.AFTER);
  // TODO: We need to slash the user whose update was force-canceled without justification. Link to bug https://mangatafinance.atlassian.net/browse/MGX-1365
  // const penaltyValue = testUser
  //   .getAsset(GASP_ASSET_ID)
  //   ?.amountBefore.reserved!.sub(
  //     testUser.getAsset(GASP_ASSET_ID)?.amountAfter.reserved!,
  //   );
  // expect(penaltyValue).bnEqual(await SequencerStaking.slashFineAmount());
});
