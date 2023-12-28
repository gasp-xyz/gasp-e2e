import { ApiPromise } from "@polkadot/api";
import Keyring from "@polkadot/keyring";
import { signSendAndWaitToFinishTx } from "../../txHandler";
import { BaseUser } from "./BaseUser";
import { Node } from "../Node/Node";
import { BN } from "@polkadot/util";

export class GovernanceUser extends BaseUser {
  node: Node;
  api: ApiPromise;

  constructor(keyring: Keyring, name: string, json: any, node: Node) {
    super(keyring, name, json);
    this.node = node;
    this.api = node.api!;
  }

  async runForCouncil(): Promise<void> {
    await signSendAndWaitToFinishTx(
      this.api.tx.elections.submitCandidacy(
        ((await this.api.query.elections.candidates()) as any).length,
      ),
      this.keyRingPair,
    );
  }

  async renounceCandidacy(candidateStatus: any): Promise<void> {
    await signSendAndWaitToFinishTx(
      this.api.tx.elections.renounceCandidacy(candidateStatus),
      this.keyRingPair,
    );
  }

  async vote(users: [BaseUser], stake: BN): Promise<void> {
    const userAddresses: string[] = [];

    users.forEach((user) => {
      userAddresses.push(user.keyRingPair.address);
    });

    await signSendAndWaitToFinishTx(
      this.api.tx.elections.vote(userAddresses, stake),
      this.keyRingPair,
    );
  }
}
