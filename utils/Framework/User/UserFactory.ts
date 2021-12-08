import {Keyring} from "@polkadot/api";

import {Node} from "../Node/Node";

import {GovernanceUser} from "./GovernanceUser";
import {SudoUser} from "./SudoUser";
import {MetamaskUser} from "./MetamaskUser";

export enum Users {
  GovernanceUser,
  SudoUser,
  MetamaskUser,
}

export abstract class UserFactory {
  public static createUser(
    type: Users,
    keyring: Keyring,
    node: Node,
    name: string = "",
    json: any = ""
  ) {
    switch (type) {
      case Users.GovernanceUser:
        return new GovernanceUser(keyring, name, json, node);
      case Users.SudoUser:
        return new SudoUser(keyring, name, json, node);
      case Users.MetamaskUser:
        return new MetamaskUser(keyring, json, node);
      default:
        throw new Error("Invalid User Type");
    }
  }
}
