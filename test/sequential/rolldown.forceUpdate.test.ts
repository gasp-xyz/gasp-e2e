/*
 *
 * @group sequencerStaking
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN_MILLION, signTx } from "gasp-sdk";
import {
  ExtrinsicResult,
  findEventData,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { isBadOriginError, waitForNBlocks } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { AssetWallet, User } from "../../utils/User";

async function leaveSequencing(userAddr: string) {
  const stakedEth = await SequencerStaking.sequencerStake(userAddr, "Ethereum");
  const stakedArb = await SequencerStaking.sequencerStake(userAddr, "Arbitrum");
  let chain = "";
  if (stakedEth.toHuman() !== "0") {
    chain = "Ethereum";
  } else if (stakedArb.toHuman() !== "0") {
    chain = "Arbitrum";
  }
  if (chain !== "") {
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
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

async function createAnUpdate(
  seq: User | string,
  chain: ChainName = "Arbitrum",
  forcedIndex = 0,
) {
  const address = typeof seq === "string" ? seq : seq.keyRingPair.address;
  await Rolldown.waitForReadRights(address, 50, chain);
  let txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  if (forcedIndex !== 0) {
    txIndex = forcedIndex;
  }
  const api = getApi();
  const update = new L2Update(api)
    .withDeposit(txIndex, address, address, BN_MILLION)
    .on(chain)
    .build();
  let reqId = 0;
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(address, update),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events, "SudoAsDone");
    reqId = Rolldown.getRequestIdFromEvents(events);
  });
  return { txIndex, api, reqId };
}

async function setupASequencer(user: User, chain: ChainName = "Ethereum") {
  const extrinsic = await SequencerStaking.provideSequencerStaking(
    (await SequencerStaking.minimalStakeAmount()).muln(2),
    chain,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(user),
    Sudo.sudoAs(user, extrinsic),
  );
}

let api: any;
let testUser: User;
let testUserAddress: string;
const preSetupSequencers = {
  Ethereum: "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
  Arbitrum: "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc",
};

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  api = getApi();
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
  let assetId: any;
  const txIndex = await Rolldown.lastProcessedRequestOnL2("Ethereum");
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on("Ethereum")
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

it("forceUpdateL2FromL1 can't be called by non-sudo user", async () => {
  await setupASequencer(testUser, "Ethereum");
  const txIndex = await Rolldown.lastProcessedRequestOnL2("Ethereum");
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on("Ethereum")
    .forceBuild();
  await signTx(api, update, testUser.keyRingPair).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    const isBadOrigin = isBadOriginError(events);
    expect(isBadOrigin).toEqual(true);
  });
});

it("Validate that forceCancelRequestsFromL1 can be called by Sudo", async () => {
  await setupASequencer(testUser, "Ethereum");
  const { reqId } = await createAnUpdate(testUser, "Ethereum");
  const cancel = await Rolldown.forceCancelRequestFromL1("Ethereum", reqId);
  await Sudo.asSudoFinalized(Sudo.sudo(cancel)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});

it("Validate that forceCancelRequestsFromL1 can't be called by non-sudo user", async () => {
  await setupASequencer(testUser, "Ethereum");
  const { reqId } = await createAnUpdate(testUser, "Ethereum");
  const cancel = await Rolldown.forceCancelRequestFromL1("Ethereum", reqId);
  await signTx(api, cancel, testUser.keyRingPair).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    const isBadOrigin = isBadOriginError(events);
    expect(isBadOrigin).toEqual(true);
  });
});
