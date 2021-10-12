import { Node } from "./Node";

export class Token {
  node: Node;
  supply: number;

  constructor(supply: number, node: Node) {
    this.node = node;
    this.supply = supply;
  }

  async mint(toAddress: string): Promise<void> {
    this.node.api.tx.tokens.create(toAddress, this.supply);
  }
}
