import {
  Abi,
  Address,
  Chain,
  createPublicClient,
  createWalletClient,
  http,
  PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import { encodeAddress } from "@polkadot/keyring";
import { blake2AsU8a } from "@polkadot/util-crypto";
import { BN, hexToU8a } from "@polkadot/util";
import { getApi } from "../api";
import { testLog } from "../Logger";
import { setupApi, setupUsers } from "../setup";
import { Sudo } from "../sudo";
import { Assets } from "../Assets";
import { User } from "../User";
import { EthAnvil, getL1, L1Type } from "./l1s";

export const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

export const { abi } = JSON.parse(
  fs.readFileSync("utils/rollup/RollDown.json").toString(),
);
export const erc20abi = JSON.parse(
  fs.readFileSync("utils/rollup/TestToken.json").toString(),
).abi;
export const ethWalletClient = createWalletClient({
  account,
  chain: EthAnvil as Chain,
  transport: http(),
});
export const ethPublicClient = createPublicClient({
  chain: EthAnvil as Chain,
  transport: http(),
});

export const arbWalletClient = createWalletClient({
  account,
  chain: EthAnvil as Chain,
  transport: http(),
});
export const arbPublicClient = createPublicClient({
  chain: EthAnvil as Chain,
  transport: http(),
});

export function getPublicClient(l1: L1Type = "EthAnvil") {
  return l1 === "EthAnvil" ? ethPublicClient : arbPublicClient;
}

export async function getL2UpdatesStorage(l1: L1Type = "EthAnvil") {
  const { rollDown } = getL1(l1)?.contracts!;
  return ethPublicClient.readContract({
    address: `${rollDown.address}` as Address,
    abi: abi as Abi,
    functionName: "getUpdateForL2",
  });
}
export async function getBalance(erc20Address: string, userAddress: string) {
  return ethPublicClient.readContract({
    address: `${erc20Address}` as Address,
    abi: erc20abi as Abi,
    functionName: "balanceOf",
    args: [userAddress],
  });
}
export function convertEthAddressToDotAddress(ethAddress: string) {
  return encodeAddress(blake2AsU8a(hexToU8a(ethAddress)), 42);
}
export async function getAssetIdFromErc20(ethTokenAddress: string, l1: L1Type) {
  const param = JSON.parse(
    `{"${getL1(l1)?.gaspName}" : "${ethTokenAddress}" }`,
  );
  const assetId = await getApi().query.assetRegistry.l1AssetToId(param);
  return new BN(assetId.toString());
}

export async function mintERC20TokensOnEthL1(
  ethAddress: string,
  number: number,
  erc20Address: `0x${string}`,
) {
  const { request } = await ethPublicClient.simulateContract({
    account,
    address: erc20Address,
    abi: erc20abi as Abi,
    functionName: "mint",
    args: [ethAddress, BigInt(number * 10 ** 18)],
  });
  await ethWalletClient.writeContract(request);
}
export async function setBalance(
  ethAddress: string,
  amount: number,
  l1: L1Type,
) {
  const host = getL1(l1)?.rpcUrls.default.http[0];
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
    // eslint-disable-next-line no-console
    .then((result) => console.log(result))
    // eslint-disable-next-line no-console
    .catch((error) => console.error(error));
}

export async function approveTokens(
  ethUser: User,
  erc20Address: `0x${string}`,
  contractAddress: string,
  amount: number = 10e18,
) {
  const acc: PrivateKeyAccount = privateKeyToAccount(
    ethUser.name as `0x${string}`,
  );
  const walletClient = createWalletClient({
    account: acc,
    chain: EthAnvil as Chain,
    transport: http(),
  });
  const { request } = await ethPublicClient.simulateContract({
    account: acc,
    address: erc20Address,
    abi: erc20abi as Abi,
    functionName: "approve",
    args: [contractAddress, amount],
  });
  await walletClient.writeContract(request);
}

export async function setupEthUser(
  ethUser: User,
  erc20Address: `0x${string}`,
  rollDownContractAddress: string,
  amountToApprove: number,
  l1: L1Type = "EthAnvil",
) {
  await setBalance(ethUser.keyRingPair.address, 10e18, l1);
  await mintERC20TokensOnEthL1(
    ethUser.keyRingPair.address,
    10e18,
    getL1(l1)?.contracts.dummyErc20.address!,
  );

  const balance = await getBalance(erc20Address, ethUser.keyRingPair.address);
  testLog.getLog().info(balance);
  await approveTokens(
    ethUser,
    erc20Address,
    rollDownContractAddress,
    amountToApprove,
  );
}
export async function fakeDepositOnL2(
  ethUser: User,
  erc20Address: `0x${string}`,
  rollDownContractAddress: string,
  amount: BN,
  l1: L1Type = "EthAnvil",
) {
  //Mint some tokens to the contract ( as if the user deposited them)
  await mintERC20TokensOnEthL1(
    rollDownContractAddress,
    amount.toNumber(),
    erc20Address,
  );
  setupUsers();
  await setupApi();
  const tokenId = await getAssetIdFromErc20(erc20Address, l1);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(
      Assets.mintTokenAddress(tokenId, ethUser.keyRingPair.address, amount),
    ),
    Assets.mintNative(ethUser),
  );
}
