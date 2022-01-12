import BN from "bn.js";
import { BaseUser } from "./BaseUser";
import { ExtrinsicResult } from "../../eventListeners";
import { getEventResultFromMangataTx } from "../../txHandler";
import { Keyring } from "@polkadot/api";
import { mintAsset } from "../../tx";
import { Node } from "../Node/Node";
import { Token } from "../Supply/Token";
import { getEnvironmentRequiredVars } from "../../utils";

export class SudoUser extends BaseUser {
  node: Node;

  constructor(keyring: Keyring, json: any, node: Node) {
    const { sudo: sudoName } = getEnvironmentRequiredVars();
    super(keyring, sudoName, json);
    this.node = node;
  }

  async mintToken(assetId: BN, amount: BN): Promise<Token> {
    await mintAsset(
      this.keyRingPair,
      assetId,
      this.keyRingPair.address,
      amount
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Minted",
        this.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    return new Token(assetId, amount);
  }
}
