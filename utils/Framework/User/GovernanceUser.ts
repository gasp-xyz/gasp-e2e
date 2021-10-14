import { ApiPromise } from "@polkadot/api";
import Keyring from "@polkadot/keyring";
import { ExtrinsicResult } from "../../eventListeners";
import {
  getCurrentNonce,
  getEventResultFromTxWait,
  signAndWaitTx,
} from "../../txHandler";
import { User } from "../../User";
import { Node } from "../Node/Node";

export class GovernanceUser extends User {
  node: Node;
  api: ApiPromise;

  constructor(keyring: Keyring, name: string, json: any, node: Node) {
    super(keyring, name, json);
    this.node = node;
    this.api = node.api!;
  }

  async vote(users: [User], stake: number): Promise<void> {
    const userAddresses: string[] = [];

    users.forEach((user) => {
      userAddresses.push(user.keyRingPair.address);
    });

    await signAndWaitTx(
      this.api.tx.elections
        .vote(userAddresses, stake)
        .signAndSend(this.keyRingPair),
      this.keyRingPair.address,
      await getCurrentNonce(this.keyRingPair.address)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "xyk",
        "AssetsSwapped",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  }
}
