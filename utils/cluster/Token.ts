import { Node } from "./Node";

export class Token {
  name: string;
  supply: number;
  node: Node;

  constructor(name: string, supply: number, node: Node) {
    this.name = name;
    this.node = node;
    this.supply = supply;
  }

  async mint(toAddress: string): Promise<void> {
    this.node!.api!.tx.tokens.create(toAddress, this.supply);
  }
}
