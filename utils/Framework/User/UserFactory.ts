import { Keyring } from "@polkadot/api";

import { Node } from "../Node/Node.js";

import { GovernanceUser } from "./GovernanceUser.js";
import { SudoUser } from "./SudoUser.js";
import { MetamaskUser } from "./MetamaskUser.js";
import { RegularUser } from "./RegularUser.js";
import { BaseUser } from "./BaseUser.js";

export enum Users {
  GovernanceUser,
  SudoUser,
  MetamaskUser,
  RegularUser,
}

export abstract class UserFactory {
  users: BaseUser[] = [];

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
        return new SudoUser(keyring, node, json);
      case Users.MetamaskUser:
        return new MetamaskUser(keyring, json, node);
      case Users.RegularUser:
        return new RegularUser(keyring, json, node);
      default:
        throw new Error("Invalid User Type");
    }
  }

  createUsers(numUsers: number, keyring: Keyring, node: Node) {
    for (let i = 0; i < numUsers; i++) {
      this.users.push(UserFactory.createUser(Users.RegularUser, keyring, node));
    }
  }
}
