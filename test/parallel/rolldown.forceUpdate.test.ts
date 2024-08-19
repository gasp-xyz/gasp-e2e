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
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { isBadOriginError, waitForNBlocks } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

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

let api: any;
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
});

it("forceUpdateL2FromL1 can be called by Sudo", async () => {
  const [testUser] = setupUsers();
  const testUserAddress = testUser.keyRingPair.address;
  const providingExtrinsic = await SequencerStaking.provideSequencerStaking(
    (await SequencerStaking.minimalStakeAmount()).muln(2),
    "Ethereum",
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Sudo.sudoAs(testUser, providingExtrinsic),
  );
  const txIndex = await Rolldown.lastProcessedRequestOnL2("Ethereum");
  const update = new L2Update(api)
    .withDeposit(txIndex, testUserAddress, testUserAddress, BN_MILLION)
    .on("Ethereum")
    .forceBuild();
  await Sudo.asSudoFinalized(Sudo.sudo(update)).then(async (events) => {
    await waitSudoOperationSuccess(events);
  });
});

it("forceUpdateL2FromL1 can't be called by non-sudo user", async () => {
  const [testUser] = setupUsers();
  const testUserAddress = testUser.keyRingPair.address;
  const providingExtrinsic = await SequencerStaking.provideSequencerStaking(
    (await SequencerStaking.minimalStakeAmount()).muln(2),
    "Ethereum",
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Sudo.sudoAs(testUser, providingExtrinsic),
  );
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
