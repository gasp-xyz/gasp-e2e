import { getApi } from "../api";
import { setupUsers } from "../setup";
import { Keyring } from "@polkadot/api";
import { EthUser } from "../EthUser";
import { stringToBN } from "../utils";
import { BN, BN_ZERO } from "@polkadot/util";
export type ChainName = "Ethereum" | "Arbitrum";
const baltathar = "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0";
export const wellKnownUsers: Record<string, string> = {
  "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0":
    "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b",
};

export class SequencerStaking {
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
  ) {
    const api = await getApi();
    let amountToStake = amount;
    if (amountToStake.isZero()) {
      amountToStake = await SequencerStaking.minimalStakeAmount();
      amountToStake = amountToStake.addn(1000);
    }
    return api.tx.sequencerStaking.provideSequencerStake(
      chainName,
      stringToBN(amountToStake.toString()),
      null
    );
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

  static async maxSequencers() {
    const api = getApi();
    return await api.consts.sequencerStaking.maxSequencers;
  }
}
