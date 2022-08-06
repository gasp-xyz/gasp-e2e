import { Keyring } from "@polkadot/api";

import { Node } from "../Node/Node";

import { GovernanceUser } from "./GovernanceUser";
import { SudoUser } from "./SudoUser";
import { MetamaskUser } from "./MetamaskUser";
import { RegularUser } from "./RegularUser";
import { BN } from "@polkadot/util";
import { BaseUser } from "./BaseUser";
import { SudoDB } from "../../SudoDB";
import { MangataGenericEvent, signTx } from "@mangata-finance/sdk";
import { env } from "process";
import { testLog } from "../../Logger";

export enum Users {
  GovernanceUser,
  SudoUser,
  MetamaskUser,
  RegularUser,
}

export abstract class UserFactory {
  users: BaseUser[] = [];
  batchedFucntions: any[] = [];

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
  withTokens(
    tokenIds: BN[],
    amount: BN = new BN(Math.pow(10, 20).toString()),
    testUser?: BaseUser
  ) {
    tokenIds.forEach((token) => {
      if (testUser) {
        this.batchedFucntions.push(
          testUser.node?.api!.tx.sudo.sudo(
            testUser.node?.api!.tx.tokens.mint(
              token,
              testUser.keyRingPair.address,
              amount
            )
          )
        );
      } else {
        this.users.forEach((user) => {
          this.batchedFucntions.push(
            user.node?.api!.tx.sudo.sudo(
              user.node?.api!.tx.tokens.mint(
                token,
                user.keyRingPair.address,
                amount
              )
            )
          );
        });
      }
    });
    return this;
  }
  withFn(fn: any) {
    this.batchedFucntions.push(fn);
    return this;
  }
  async sudoBatch(sudo: SudoUser) {
    const nonce = new BN(
      await SudoDB.getInstance().getSudoNonce(sudo.keyRingPair.address)
    );
    const txResult = await signTx(
      sudo.node?.api!,
      sudo.node?.api!.tx.utility.batch(this.batchedFucntions)!,
      sudo.keyRingPair,
      { nonce: new BN(nonce) }
    ).catch((reason) => {
      // eslint-disable-next-line no-console
      console.error("OhOh sth went wrong. " + reason.toString());
      testLog.getLog().error(`W[${env.JEST_WORKER_ID}] - ${reason.toString()}`);
    });
    return txResult as MangataGenericEvent[];
  }
}
