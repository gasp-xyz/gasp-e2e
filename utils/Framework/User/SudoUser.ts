import BN from "bn.js";
import { BaseUser } from "./BaseUser";
import { ExtrinsicResult } from "../../eventListeners";
import { getEventResultFromTxWait } from "../../txHandler";
import { Keyring } from "@polkadot/api";
import { mintAsset } from "../../tx";
import { Node } from "../Node/Node";
import { Token } from "../Supply/Token";

export class SudoUser extends BaseUser {
  node: Node;

  constructor(keyring: Keyring, name: string, json: any, node: Node) {
    super(keyring, name, json);
    this.node = node;
  }

  async mintToken(assetId: BN, amount: BN): Promise<Token> {
    await mintAsset(
      this.keyRingPair,
      assetId,
      this.keyRingPair.address,
      amount
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        "tokens",
        "Minted",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    return new Token(assetId, amount);
  }

  async fundUser(user: BaseUser, token: Token, amount: BN): Promise<void> {}
}
