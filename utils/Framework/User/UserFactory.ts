import { Keyring } from "@polkadot/api";

import { GovernanceUser } from "./GovernanceUser";
import { Node } from "../Node";
import { SudoUser } from "./SudoUser";
import { User } from "../../User";

export enum Users {
  User,

  GovernanceUser,
  SudoUser,
}

export class UserFactory {
  public static createUser(
    type: Users,
    keyring: Keyring,
    node: Node,
    name: string = "",
    json: any = ""
  ): User | null {
    if (type === Users.User) {
      return new User(keyring, name, json);
    }
    if (type === Users.GovernanceUser) {
      return new GovernanceUser(keyring, name, json, node);
    }
    if (type === Users.SudoUser) {
      return new SudoUser(keyring, name, json, node);
    }

    return null;
  }
}
