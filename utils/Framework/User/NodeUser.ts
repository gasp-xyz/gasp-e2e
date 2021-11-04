import { BaseUser } from "./BaseUser";
import { Keyring } from "@polkadot/api";
import { Node } from "../Node/Node";

export class NodeUser extends BaseUser {
  node: Node;

  constructor(keyring: Keyring, name: string, node: Node, json?: any) {
    super(keyring, name, json);
    this.node = node;
  }
}
