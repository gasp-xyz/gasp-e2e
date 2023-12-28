import { Keyring } from "@polkadot/api";

import { Node } from "../Node/Node";

import { GovernanceUser } from "./GovernanceUser";
import { SudoUser } from "./SudoUser";
import { MetamaskUser } from "./MetamaskUser";
import { RegularUser } from "./RegularUser";
import { BaseUser } from "./BaseUser";

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
    json: any = "",
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
