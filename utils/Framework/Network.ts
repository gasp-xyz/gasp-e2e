// import {Keyring} from "@polkadot/api";

import { Node } from "./Node/Node";
import { BaseUser } from "./User/BaseUser";
// import {SudoUser} from "./User/SudoUser";

export class Network {
  //  private _keyring: Keyring;
  private _bootnode: Node;
  private _nodes: Array<Node>;
  //  private _sudo: SudoUser;
  private _users: Array<BaseUser>;

  public getState() {
    return {
      nodes: this._nodes,
      bootnode: this._bootnode,
      users: this._users,
    };
  }

  constructor(
    //    keyring: Keyring,
    bootnode: Node,
    nodes: Node[],
    //    sudo: SudoUser,
    users: any,
  ) {
    //    this._keyring = keyring;
    this._bootnode = bootnode;
    this._nodes = nodes;
    //    this._sudo = sudo;
    this._users = users;
  }
}
