import { getApi } from "../api";
import { setupUsers } from "../setup";
import { Keyring } from "@polkadot/api";
import { EthUser } from "../EthUser";
import { stringToBN } from "../utils";
import { BN, BN_ZERO } from "@polkadot/util";
import { leaveSequencing } from "./Rolldown";
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
  static async minimalStakeAmount() {
    const api = getApi();
    return (await api.query.sequencerStaking.minimalStakeAmount()) as any as BN;
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

  static async maxSequencers() {
    const api = getApi();
    return await api.consts.sequencerStaking.maxSequencers;
  }

  static async blocksForSequencerUpdate() {
    const api = getApi();
    return await api.consts.sequencerStaking.blocksForSequencerUpdate.toNumber();
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
