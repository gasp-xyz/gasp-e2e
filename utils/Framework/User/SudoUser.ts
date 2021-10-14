import BN from "bn.js";
import { BaseUser } from "./BaseUser";
import { Keyring } from "@polkadot/api";
import { Node } from "../Node/Node";
import { Token } from "../Token";

export class SudoUser extends BaseUser {
  node: Node;

  constructor(keyring: Keyring, name: string, json: any, node: Node) {
    super(keyring, name, json);
    this.node = node;
  }

  async mintToken(supply: BN): Promise<Token> {
    return new Token();
  }

  async fundUser(user: BaseUser, token: Token, amount: BN): Promise<void> {}
}
