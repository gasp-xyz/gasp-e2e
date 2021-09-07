import { Node } from "./types";

export { getAllNodesLatestHash, getBalanceAtHash, getLastBlockHash };

async function getBalanceAtHash(node: Node, hash: string, address: string) {
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
      const hash = await getLastBlockHash(node);
      // eslint-disable-next-line no-console
      console.log(`${node.name}: ${hash}`);
      return hash;
    })
  );

  return hashes;
};
