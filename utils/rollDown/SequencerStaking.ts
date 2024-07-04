import { getApi } from "../api";
import { setupUsers } from "../setup";
import { Keyring } from "@polkadot/api";
import { EthUser } from "../EthUser";
import { stringToBN } from "../utils";
export type ChainName = "Ethereum" | "Arbitrum";
const baltathar = "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0";
export const wellKnownUsers: Record<string, string> = {
  "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0":
    "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b",
};

export class SequencerStaking {
  static async getSequencerUser() {
    setupUsers();
    const pkey = wellKnownUsers[baltathar];
    return new EthUser(new Keyring({ type: "ethereum" }), pkey);
  }
  static async provideSequencerStaking(chainName: ChainName = "Ethereum") {
    const api = await getApi();
    const minAmount = await api.query.sequencerStaking.minimalStakeAmount();
    return api.tx.sequencerStaking.provideSequencerStake(
      chainName,
      stringToBN(minAmount.toString()).addn(1000),
    );
  }

  static async leaveSequencerStaking(chainName: ChainName = "Ethereum") {
    const api = await getApi();
    return api.tx.sequencerStaking.leaveActiveSequencers(chainName);
  }
  static async unstake(chainName: ChainName = "Ethereum") {
    const api = await getApi();
    return api.tx.sequencerStaking.unstake(chainName);
  }
}
