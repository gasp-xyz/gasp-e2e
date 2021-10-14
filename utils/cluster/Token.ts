import BN from "bn.js";
import { Node } from "./Node";

export class Token {
  name: string;
  supply: number;
  node: Node;
  tokenId: BN;

  constructor(
    name: string,
    supply: number,
    node: Node,
    tokenId: BN = new BN(0)
  ) {
    this.name = name;
    this.node = node;
    this.supply = supply;
    this.tokenId = tokenId;
  }

  async mint(toAddress: string): Promise<void> {
    this.node!.api!.tx.tokens.create(toAddress, this.supply);
  }
}
