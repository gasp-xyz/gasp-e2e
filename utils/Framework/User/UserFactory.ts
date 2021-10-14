import { Keyring } from "@polkadot/api";

import { Node } from "../Node";

import { GovernanceUser } from "./GovernanceUser";
import { SudoUser } from "./SudoUser";

export enum Users {
  GovernanceUser,
  SudoUser,
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
      default:
        throw new Error("Invalid User Type");
    }
  }
}
