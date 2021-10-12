import { Keyring } from "@polkadot/api";
import { VoidFn } from "@polkadot/api/types";

import { promises as fs } from "fs";
import { Convert } from "../Config";

import { Node } from "./Node";
import { User } from "./User";
import { Token } from "./Token";

export class Network {
  master: Node;
  nodes: [Node];
  users: [User];
  tokens: [Token];
  keyring: Keyring;

  unsubscribe: VoidFn;

  state: {};

  constructor(filePath: string) {
    fs.readFile(filePath, "utf-8").then((fileContents) => {
      const config = Convert.toTestConfig(fileContents);
      config.nodes.forEach((node) => {
        this.nodes.push(new Node(node.name, node.wsPath));
      });
      config.users.forEach((user) => {
        this.users.push(new User(user.name));
      });
    });

    this.master = this.nodes[0];
    this.keyring = new Keyring({ type: "sr25519" });

    this.users.forEach((user) => {
      this.keyring.addFromUri(user.name);
    });
  }

  async startNodes(): Promise<void> {
    const promises = [];
    for (let index = 0; index < this.nodes.length; index++) {
      const element = this.nodes[index];
      promises.push(element.connect());
    }
    await Promise.all(promises);

    for (let index = 0; index < this.nodes.length; index++) {
      const element = this.nodes[index];
      promises.push(element.subscribeToHead());
    }
    await Promise.all(promises);
  }

  async sync(): Promise<void> {
    this.unsubscribe = await this.master.api.rpc.chain.subscribeNewHeads(
      (lastHeader) => {
        this.users.forEach((user) => {
          user.refresh();
        });
      }
    );
  }

  async stop(): Promise<void> {
    this.unsubscribe();
  }

  async createToken(): Promise<void> {}

  async fundUser(user: User): Promise<void> {}
}
