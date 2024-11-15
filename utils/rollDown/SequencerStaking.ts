import { getApi } from "../api";
import { setupUsers } from "../setup";
import { Keyring } from "@polkadot/api";
import { EthUser } from "../EthUser";
import { stringToBN, waitForNBlocks } from "../utils";
import { BN, BN_ZERO } from "@polkadot/util";
import { User } from "../User";
import { Sudo } from "../sudo";
import { Assets } from "../Assets";

export type ChainName = "Ethereum" | "Arbitrum";
const baltathar = "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0";
export const wellKnownUsers: Record<string, string> = {
  "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0":
    "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b",
};

export class SequencerStaking {
  static async setupASequencer(user: User, chain: ChainName = "Ethereum") {
    const extrinsic = await SequencerStaking.provideSequencerStaking(
      (await SequencerStaking.minimalStakeAmount()).addn(1000),
      chain,
    );
    return await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user),
      Sudo.sudoAs(user, extrinsic),
    );
  }

  static async getSequencerUser() {
    setupUsers();
    //const api = await getApi();
    //const sequencer = await api.query.sequencerStaking.selectedSequencer();
    // @ts-ignore
    const pkey = wellKnownUsers[baltathar];
    return new EthUser(new Keyring({ type: "ethereum" }), pkey);
  }
  static async provideSequencerStaking(
    amount: BN = BN_ZERO,
    chainName: ChainName = "Ethereum",
    stakeAndJoin = true,
  ) {
    let stakeAction: any;
    if (stakeAndJoin) {
      stakeAction = "StakeAndJoinActiveSet";
    } else {
      stakeAction = "StakeOnly";
    }
    const api = await getApi();
    let amountToStake = amount;
    if (amountToStake.isZero()) {
      amountToStake = await SequencerStaking.minimalStakeAmount();
      amountToStake = amountToStake.addn(1000);
    }
    return api.tx.sequencerStaking.provideSequencerStake(
      chainName,
      stringToBN(amountToStake.toString()),
      null,
      stakeAction,
    );
  }

  static async rejoinActiveSequencers(chainName: ChainName = "Ethereum") {
    const api = await getApi();
    return api.tx.sequencerStaking.rejoinActiveSequencers(chainName);
  }

  static async leaveSequencerStaking(chainName: ChainName = "Ethereum") {
    const api = getApi();
    return api.tx.sequencerStaking.leaveActiveSequencers(chainName);
  }
  static async unstake(chainName: ChainName = "Ethereum") {
    const api = getApi();
    return api.tx.sequencerStaking.unstake(chainName);
  }

  static payoutRewards(sequencerAddress: string, numberOfSession: any = null) {
    const api = getApi();
    return api.tx.sequencerStaking.payoutSequencerRewards(
      sequencerAddress,
      numberOfSession,
    );
  }

  static async minimalStakeAmount() {
    const api = getApi();
    return (await api.query.sequencerStaking.minimalStakeAmount()) as any as BN;
  }

  static blocksForSequencerUpdate() {
    const api = getApi();
    return api.consts.sequencerStaking
      .blocksForSequencerUpdate as any as number;
  }

  static async roundSequencerRewardInfo(
    address: string,
    sessionNumber: number,
  ) {
    const api = getApi();
    const rewards = await api.query.sequencerStaking.roundSequencerRewardInfo(
      address,
      [sessionNumber],
    );
    return new BN(rewards.toString());
  }

  static async activeSequencers() {
    const api = getApi();
    return await api.query.sequencerStaking.activeSequencers();
  }

  static async sequencerStake(address: string, chain: string) {
    const api = getApi();
    return await api.query.sequencerStaking.sequencerStake([address, chain]);
  }

  static async slashFineAmount() {
    const api = getApi();
    return await api.query.sequencerStaking.slashFineAmount();
  }

  static async awardedPts(roundNumber: number, address: string) {
    const api = getApi();
    return await api.query.sequencerStaking.awardedPts(roundNumber, address);
  }

  static async points(roundNumber: number) {
    const api = getApi();
    return await api.query.sequencerStaking.points(roundNumber);
  }

  static async maxSequencers() {
    const api = getApi();
    return await api.consts.sequencerStaking.maxSequencers;
  }

  static async getBlocksNumberForSeqUpdate() {
    const api = getApi();
    return await api.consts.sequencerStaking.blocksForSequencerUpdate.toNumber();
  }

  static async removeAddedSequencers(waitPeriod: number = 0) {
    const preSetupSequencers = {
      Ethereum: "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
      Arbitrum: "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc",
    };
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
      await waitForNBlocks(waitPeriod);
    }
  }

  static async removeAllSequencers() {
    const activeSequencers = await SequencerStaking.activeSequencers();
    for (const chain in activeSequencers.toHuman()) {
      for (const seq of activeSequencers.toHuman()[chain] as string[]) {
        if (seq !== null) {
          await leaveSequencing(seq);
        }
      }
    }
  }

  static async setSequencerConfiguration(
    chain: ChainName,
    minStake: BN,
    slashFine: BN,
  ) {
    const api = await getApi();
    return api.tx.sequencerStaking.setSequencerConfiguration(
      chain,
      minStake,
      slashFine,
    );
  }
}

export async function leaveSequencing(userAddr: string) {
  const stakedEth = await SequencerStaking.sequencerStake(userAddr, "Ethereum");
  const stakedArb = await SequencerStaking.sequencerStake(userAddr, "Arbitrum");
  let chain = "";
  if (stakedEth.toHuman() !== "0") {
    chain = "Ethereum";
  } else if (stakedArb.toHuman() !== "0") {
    chain = "Arbitrum";
  }
  if (chain !== "") {
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
