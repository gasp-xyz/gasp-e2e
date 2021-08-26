import { Node } from "./types";

import { CodecHash } from "@polkadot/types/interfaces";

export { getAllNodesLatestHash, getBalanceAtHash, getLastBlockHash };

async function getBalanceAtHash(node: Node, hash: CodecHash, address: string) {
  const balance = await node.api?.query.system.account.at(hash, address);
  return balance;
}

async function getLastBlockHash(node: Node) {
  const response = await node.api?.rpc.chain.getHeader();

  if (response?.hash) {
    return response.hash;
  } else {
    return null;
  }
}

const getAllNodesLatestHash = async (nodes: Node[]) => {
  const hashes = Promise.all(
    nodes.map(async (node) => {
      let hash = await getLastBlockHash(node);
      console.log(`${node.name}: ${hash}`);
      return hash;
    })
  );

  return hashes;
};
