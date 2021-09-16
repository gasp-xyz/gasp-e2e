import { Node } from "./types";

export { getAllNodesLatestHash, getBalanceAtHash, getLastBlockHash };

async function getBalanceAtHash(node: Node, hash: string, address: string) {
  const balance = await node.api?.query.system.account.at(hash, address);
  return balance;
}

async function getLastBlockHash(node: Node): Promise<string> {
  const response = await node.api?.rpc.chain.getHeader();

  if (response?.hash) {
    return response.hash.toString();
  } else {
    return null;
  }
}

const getAllNodesLatestHash = async (nodes: Node[]): Promise<string[]> => {
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
