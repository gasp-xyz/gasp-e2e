import { Keyring } from "@polkadot/api";
import { User } from "../../User";
import { Node } from "../Node/Node";

export class SudoUser extends User {
  node: Node;

  constructor(keyring: Keyring, name: string, json: any, node: Node) {
    super(keyring, name, json);
    this.node = node;
  }
}
