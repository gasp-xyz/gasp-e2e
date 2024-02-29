import {
  Abi,
  Address,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import { encodeAddress } from "@polkadot/keyring";
import { blake2AsU8a } from "@polkadot/util-crypto";
import { hexToU8a } from "@polkadot/util";

export const ROLL_DOWN_CONTRACT_ADDRESS =
  "0x5f3f1dbd7b74c6b46e8c44f98792a1daf8d69154";

export const ERC20_ADDRESS = "0xb7278a61aa25c888815afc32ad3cc52ff24fe575";
export const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

export const { abi } = JSON.parse(
  fs.readFileSync("utils/rollup/rolldown.json").toString(),
);
export const walletClient = createWalletClient({
  account,
  chain: anvil,
  transport: http(),
});
export const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

export async function getL2UpdatesStorage(
  rollDownAddress = ROLL_DOWN_CONTRACT_ADDRESS,
) {
  return publicClient.readContract({
    address: `${rollDownAddress}` as Address,
    abi: abi as Abi,
    functionName: "getUpdateForL2",
  });
}

export function convertEthAddressToDotAddress(ethAddress: string) {
  return encodeAddress(blake2AsU8a(hexToU8a(ethAddress)), 42);
}
