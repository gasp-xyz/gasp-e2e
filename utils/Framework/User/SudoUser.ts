import { Keyring } from "@polkadot/api";
import { Node } from "../Node/Node";
import { BaseUser } from "./BaseUser";

export class SudoUser extends BaseUser {
  node: Node;

  constructor(keyring: Keyring, name: string, json: any, node: Node) {
    super(keyring, name, json);
    this.node = node;
  }
}
