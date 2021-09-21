import { expose } from "threads/worker";
import { Node } from "../types";

const nodeWorker = {
  async getHash(node: Node) {
    const response = await node.api?.rpc.chain.getHeader();

    if (response?.hash) {
      return response.hash.toString();
    } else {
      return null;
    }
  },
};

export type NodeWorker = typeof nodeWorker;

expose(nodeWorker);
