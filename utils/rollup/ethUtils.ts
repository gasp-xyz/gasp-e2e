import {
  Abi,
  Address,
  createPublicClient,
  createWalletClient,
  http, PrivateKeyAccount
} from "viem";
import { anvil } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import { encodeAddress } from "@polkadot/keyring";
import { blake2AsU8a } from "@polkadot/util-crypto";
import { hexToU8a } from "@polkadot/util";
import { getApi } from "../api";
import { EthUser } from "../EthUser";
import { testLog } from "../Logger";

export const ROLL_DOWN_CONTRACT_ADDRESS =
  "0x5f3f1dbd7b74c6b46e8c44f98792a1daf8d69154";

export const ERC20_ADDRESS = "0xb7278a61aa25c888815afc32ad3cc52ff24fe575";
export const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

export const { abi } = JSON.parse(
  fs.readFileSync("utils/rollup/rolldown.json").toString(),
);
export const erc20abi = JSON.parse(
  fs.readFileSync("utils/rollup/TestToken.json").toString(),
).abi;
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
export async function getBalance(address = ERC20_ADDRESS, userAddress: string) {
  return publicClient.readContract({
    address: `${address}` as Address,
    abi: erc20abi as Abi,
    functionName: "balanceOf",
    args: [userAddress],
  });
}
export function convertEthAddressToDotAddress(ethAddress: string) {
  return encodeAddress(blake2AsU8a(hexToU8a(ethAddress)), 42);
}
export async function getAssetIdFromErc20(ethTokenAddress = ERC20_ADDRESS) {
  const param = {
    Ethereum: ethTokenAddress,
  };
  const assetId = await getApi().query.assetRegistry.l1AssetToId(param);
  return assetId;
}

export async function mintTokens(
  ethAddress: string,
  number: number,
  erc20Address: `0x${string}` = ERC20_ADDRESS,
) {
  const { request } = await publicClient.simulateContract({
    account,
    address: erc20Address,
    abi: erc20abi as Abi,
    functionName: "mint",
    args: [ethAddress, BigInt(number * 10 ** 18)],
  });
  await walletClient.writeContract(request);
}
export async function setBalance(ethAddress: string, amount: number) {
  const host = anvil.rpcUrls.default.http[0];
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  const raw = JSON.stringify({
    method: "anvil_setBalance",
    params: [ethAddress, amount],
    id: 6655,
    jsonrpc: "2.0",
  });
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };
  // @ts-ignore
  await fetch(host, requestOptions)
    .then((response) => response.text())
    .then((result) => console.log(result))
    .catch((error) => console.error(error));
}

export async function approveTokens(
  ethUser: EthUser,
  erc20Address: `0x${string}` = ERC20_ADDRESS,
  contractAddress: string = ROLL_DOWN_CONTRACT_ADDRESS,
  amount: number = 10e18,
) {
  const acc: PrivateKeyAccount = privateKeyToAccount(
    ethUser.privateKey as `0x${string}`,
  );
  const walletClient = createWalletClient({
    account: acc,
    chain: anvil,
    transport: http(),
  });
  const { request } = await publicClient.simulateContract({
    account: acc,
    address: erc20Address,
    abi: erc20abi as Abi,
    functionName: "approve",
    args: [contractAddress, amount],
  });
  await walletClient.writeContract(request);
}

export async function setupEthUser(
  ethUser: EthUser,
  erc20Address: `0x${string}` = ERC20_ADDRESS,
  rollDownContractAddress: string = ROLL_DOWN_CONTRACT_ADDRESS,
  amountToApprove: number,
) {
  await setBalance(ethUser.ethAddress, 10e18);
  await mintTokens(ethUser.ethAddress, 10e18);

  const balance = await getBalance(erc20Address, ethUser.ethAddress);
  testLog.getLog().info(balance);
  await approveTokens(
    ethUser,
    erc20Address,
    rollDownContractAddress,
    amountToApprove,
  );
}