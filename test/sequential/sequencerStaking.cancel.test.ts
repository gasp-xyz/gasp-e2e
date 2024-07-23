/*
 *
 * @group sequencerStaking
 */

import {
  ChainName,
  SequencerStaking,
} from "../../utils/rollDown/SequencerStaking";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_MILLION, signTx } from "gasp-sdk";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers } from "../../utils/setup";
import { expectExtrinsicSucceed, waitForNBlocks } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { waitSudoOperationSuccess } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { BN_ZERO } from "@polkadot/util";
import { MGA_ASSET_ID } from "../../utils/Constants";

async function createACollatorUser() {
  const [user] = setupUsers();
  await Sudo.asSudoFinalized(Assets.mintNative(user));
  return user;
}

async function leaveSequencingIfAlreadySequencer(userAddr: string) {
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

async function createAnUpdateAndCancelIt(
  seq: User,
  canceler: string,
  chain: ChainName = "Ethereum",
  cancellation: boolean = true,
) {
  const address = seq.keyRingPair.address;
  await Rolldown.waitForReadRights(address, 50, chain);
  const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
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
  //const disputePeriodStartBlock = await getBlockNumber();
  let reqIdCanceled: number = 0;
  if (cancellation === true) {
    const cancel = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        canceler,
        await Rolldown.cancelRequestFromL1(chain, reqId),
      ),
    );
    await waitSudoOperationSuccess(cancel, "SudoAsDone");
    reqIdCanceled = Rolldown.getRequestIdFromCancelEvent(cancel);
  }
  //const disputePeriodEndBlock = (
  // disputePeriodStartBlock + (await Rolldown.disputePeriodLength()).toNumber()
  //).toString();
  //await waitBlockNumber(disputePeriodEndBlock, 10);
  //await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber() * 2);
  return { txIndex, api, reqId, reqIdCanceled };
}

const preSetupSequencers = {
  Ethereum: "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
  Arbitrum: "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc",
};

beforeAll(async () => {
  await initApi();
  setupUsers();
  await setupApi();
  //Add a few tokes because some tests may end up on slashing them
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      preSetupSequencers.Ethereum,
      await SequencerStaking.provideSequencerStaking(BN_ZERO, "Ethereum"),
    ),
    Sudo.sudoAsWithAddressString(
      preSetupSequencers.Arbitrum,
      await SequencerStaking.provideSequencerStaking(BN_ZERO, "Arbitrum"),
    ),
  );
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
        await leaveSequencingIfAlreadySequencer(seq);
        anysequencerGone = true;
      }
    }
  }
  if (anysequencerGone) {
    await waitForNBlocks(10);
  }
});

describe("Update cancellation -", () => {
  let chain: any;
  let seq: User;
  let canceler: User;
  beforeEach(async () => {
    chain = "Ethereum";
    const notYetSequencer = await createACollatorUser();
    canceler = await createACollatorUser();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1000),
        "Ethereum",
      ),
      notYetSequencer.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    const sequencers = await SequencerStaking.activeSequencers();
    expect(sequencers.toHuman().Ethereum).toContain(
      notYetSequencer.keyRingPair.address,
    );
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1000),
        "Ethereum",
      ),
      canceler.keyRingPair,
    ).then((events) => {
      expectExtrinsicSucceed(events);
    });
    seq = notYetSequencer;
    seq.addAsset(MGA_ASSET_ID);
    canceler.addAsset(MGA_ASSET_ID);
  });
  it("GIVEN a sequencer, WHEN <correctly> canceling an update THEN a % of the slash is given to it.", async () => {
    const cancelerAddress = canceler.ethAddress.toString();
    const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
      seq,
      cancelerAddress,
      chain,
    );
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await Rolldown.waitForReadRights(cancelerAddress, 50, "Ethereum");
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    //we approve the cancellation
    const cancelResolutionEvents = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        cancelerAddress,
        new L2Update(api)
          .withCancelResolution(txIndex, reqIdCanceled, true)
          .on("Ethereum")
          .build(),
      ),
    );
    await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
    await canceler.refreshAmounts(AssetWallet.BEFORE);
    await seq.refreshAmounts(AssetWallet.BEFORE);
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await canceler.refreshAmounts(AssetWallet.AFTER);
    await seq.refreshAmounts(AssetWallet.AFTER);
    const slashRewardCanceler = canceler
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free!.sub(
        canceler.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
      );
    const slashRewardUpdater = seq
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free!.sub(seq.getAsset(MGA_ASSET_ID)?.amountBefore.free!);
    expect(slashRewardCanceler).bnGt(BN_ZERO);
    expect(slashRewardUpdater).bnEqual(BN_ZERO);
  });

  it("GIVEN a sequencer, WHEN <in-correctly> canceling an update THEN my slash is burned.", async () => {
    const cancelerAddress = canceler.ethAddress.toString();
    const { reqIdCanceled, api } = await createAnUpdateAndCancelIt(
      seq,
      cancelerAddress,
      chain,
    );
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await Rolldown.waitForReadRights(cancelerAddress, 50, "Ethereum");
    const txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
    //we approve the cancellation
    const cancelResolutionEvents = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        cancelerAddress,
        new L2Update(api)
          .withCancelResolution(txIndex, reqIdCanceled, false)
          .on("Ethereum")
          .build(),
      ),
    );
    await waitSudoOperationSuccess(cancelResolutionEvents, "SudoAsDone");
    await canceler.refreshAmounts(AssetWallet.BEFORE);
    await seq.refreshAmounts(AssetWallet.BEFORE);
    await waitForNBlocks((await Rolldown.disputePeriodLength()).toNumber());
    await canceler.refreshAmounts(AssetWallet.AFTER);
    await seq.refreshAmounts(AssetWallet.AFTER);
    const slashRewardCanceler = canceler
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free!.sub(
        canceler.getAsset(MGA_ASSET_ID)?.amountBefore.free!,
      );
    const slashRewardUpdater = seq
      .getAsset(MGA_ASSET_ID)
      ?.amountAfter.free!.sub(seq.getAsset(MGA_ASSET_ID)?.amountBefore.free!);
    expect(slashRewardCanceler).bnEqual(BN_ZERO);
    expect(slashRewardUpdater).bnEqual(BN_ZERO);
  });
});
