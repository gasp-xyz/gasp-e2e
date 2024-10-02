import {
  Abi,
  Address,
  Chain,
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  http,
  PrivateKeyAccount,
  PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import { ArbAnvil, EthAnvil, getL1, L1Type, TestChain } from "./l1s";
import { User } from "../User";
import { getApi } from "../api";
import {
  expectExtrinsicSucceed,
  sleep,
  stringToBN,
  waitForBalanceChange,
} from "../utils";
import { testLog } from "../Logger";
import BN from "bn.js";
import { setupApi, setupUsers } from "../setup";
import { Sudo } from "../sudo";
import { Assets } from "../Assets";
import { L2Update } from "../rollDown/Rolldown";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
//import { Ferry } from "../rollDown/Ferry";
import { hexToU8a, nToBigInt } from "@polkadot/util";
import { diff } from "json-diff-ts";
import {
  OrmlTokensAccountData,
  PalletRolldownMessagesDeposit,
} from "@polkadot/types/lookup";
import { Ferry } from "../rollDown/Ferry";
export const ROLL_DOWN_CONTRACT_ADDRESS =
  "0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc";

export const ERC20_ADDRESS = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
export const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

export const { abi, metadata } = JSON.parse(
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
  chain: ArbAnvil as Chain,
  transport: http(),
});
export const arbPublicClient = createPublicClient({
  chain: ArbAnvil as Chain,
  transport: http(),
});

export function getPublicClient(l1: L1Type = "EthAnvil") {
  return l1 === "EthAnvil" ? ethPublicClient : arbPublicClient;
}
export function getWalletClient(l1: L1Type = "EthAnvil") {
  return l1 === "EthAnvil" ? ethWalletClient : arbWalletClient;
}

export async function getL2UpdatesStorage(l1: L1Type = "EthAnvil") {
  const { rollDown } = getL1(l1)?.contracts!;
  return getPublicClient(l1).readContract({
    address: `${rollDown.address}` as Address,
    abi: abi as Abi,
    functionName: "getUpdateForL2",
  });
}

export async function getNativeBalance(user: User, l1: L1Type) {
  const client = getPublicClient(l1);
  return client.getBalance({
    address: user.keyRingPair.address as `0x${string}`,
  });
}
export async function getBalance(
  erc20Address: string,
  userAddress: string,
  l1: L1Type,
) {
  const client = getPublicClient(l1);
  return client.readContract({
    address: `${erc20Address}` as Address,
    abi: erc20abi as Abi,
    functionName: "balanceOf",
    args: [userAddress],
  });
}

export async function getAssetIdFromErc20(ethTokenAddress: string, l1: L1Type) {
  const param = JSON.parse(
    `{"${getL1(l1)?.gaspName}" : "${ethTokenAddress}" }`,
  );
  const assetId = await getApi().query.assetRegistry.l1AssetToId(param);
  return stringToBN(assetId.toString());
}

export async function mintERC20TokensOnEthL1(
  ethAddress: string,
  number: number,
  erc20Address: `0x${string}`,
  l1: L1Type = "EthAnvil",
) {
  const { request } = await getPublicClient(l1).simulateContract({
    account,
    address: erc20Address,
    abi: erc20abi as Abi,
    functionName: "mint",
    args: [ethAddress, BigInt(number * 10 ** 18)],
  });

  await getWalletClient(l1).writeContract(request);
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
  l1: L1Type = "EthAnvil",
) {
  const acc: PrivateKeyAccount = privateKeyToAccount(
    ethUser.name as `0x${string}`,
  );
  const walletClient = createWalletClient({
    account: acc,
    chain: getL1(l1),
    transport: http(),
  });
  const { request } = await getPublicClient(l1).simulateContract({
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
    10,
    getL1(l1)?.contracts.dummyErc20.address!,
    l1,
  );

  const balance = await getBalance(
    erc20Address,
    ethUser.keyRingPair.address,
    l1,
  );
  testLog.getLog().info(balance);
  await approveTokens(
    ethUser,
    erc20Address,
    rollDownContractAddress,
    amountToApprove,
    l1,
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
    l1,
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

export function getDecodedData(
  methodName: string,
  pendingUpdates: `0x${string}`,
): Array<L2Update> {
  return decodeAbiParameters(
    abi.find((e: any) => e.name === methodName)!.inputs,
    pendingUpdates,
  ) as unknown as Array<L2Update>;
}

export function convertEthAddressToDotAddress(ethAddress: string) {
  return encodeAddress(blake2AsU8a(hexToU8a(ethAddress)), 42);
}

export async function depositAndWait(
  depositor: User,
  l1: L1Type = "EthAnvil",
  onlyContractDeposit = false,
  withFerry = false,
) {
  const updatesBefore = await getL2UpdatesStorage(l1);
  testLog.getLog().info(JSON.stringify(updatesBefore));
  const acc: PrivateKeyAccount = privateKeyToAccount(
    depositor.name as `0x${string}`,
  );
  const publicClient = getPublicClient(l1);
  const amount = BigInt(112233445566);
  const args = [getL1(l1)?.contracts.dummyErc20.address, amount];
  if (withFerry) {
    args.push(BigInt(6666));
  }

  const { request } = await publicClient.simulateContract({
    account: acc,
    address: getL1(l1)?.contracts?.rollDown.address!,
    abi: abi as Abi,
    functionName: "deposit",
    args: args,
  });
  const wc = createWalletClient({
    account: acc,
    chain: getL1(l1),
    transport: http(),
  });
  await wc.writeContract(request);
  const updatesAfter = await getL2UpdatesStorage(l1);

  const assetId = await getAssetIdFromErc20(
    getL1(l1)?.contracts.dummyErc20.address!,
    l1,
  );

  const pWaiter = waitForBalanceChange(
    depositor.keyRingPair.address,
    40,
    assetId,
  );

  if (withFerry) {
    const ferrier = await Ferry.setupFerrier(
      l1,
      getL1(l1)?.contracts.dummyErc20.address!,
    );
    const diffStorage = diff(
      JSON.parse(JSON.stringify(updatesBefore)),
      JSON.parse(JSON.stringify(updatesAfter)),
    );
    testLog.getLog().info(JSON.stringify(diffStorage));
    const newDeposit = diffStorage[0]!.changes![0].value!;

    const deposit = new L2Update(getApi())
      .withDeposit(
        newDeposit.requestId.id,
        depositor.keyRingPair.address,
        //@ts-ignore
        getL1(l1)!.contracts.dummyErc20.address,
        new BN(amount.toString()),
        newDeposit.timeStamp,
        new BN(newDeposit.ferryTip.toString()),
      )
      .buildParams()
      .pendingDeposits[0] as unknown as PalletRolldownMessagesDeposit;

    const res = await Ferry.ferryThisDeposit(ferrier, deposit, l1);

    //Assert: Op when t fine & user got his tokens.
    expectExtrinsicSucceed(res);
    const userBalanceExpectedAmount = new BN(amount.toString()).sub(
      new BN(newDeposit.ferryTip.toString()),
    );
    const balance = await depositor.getBalanceForEthToken(
      getL1(l1)!.contracts.dummyErc20.address,
    );
    expect(balance.free.toString()).toEqual(
      userBalanceExpectedAmount.toString(),
    );
  }
  if (onlyContractDeposit) {
    return;
  }
  testLog.getLog().info(depositor.keyRingPair.address);
  // Wait for the balance to change
  return await pWaiter;
}

export async function depositAndWaitNative(
  depositor: User,
  l1: L1Type = "EthAnvil",
  withFerry = false,
) {
  const updatesBefore = await getL2UpdatesStorage(l1);
  testLog.getLog().info(JSON.stringify(updatesBefore));
  const acc: PrivateKeyAccount = privateKeyToAccount(
    depositor.name as `0x${string}`,
  );
  const publicClient = getPublicClient(l1);

  const args = [];
  if (withFerry) {
    args.push(BigInt(6666));
  }
  const amount = BigInt(112233445566);
  const { request } = await publicClient.simulateContract({
    account: acc,
    address: getL1(l1)?.contracts?.rollDown.address!,
    abi: abi as Abi,
    functionName: "deposit_native",
    value: amount,
    args: args,
  });
  const wc = createWalletClient({
    account: acc,
    chain: getL1(l1),
    transport: http(),
  });
  await wc.writeContract(request);

  const updatesAfter = await getL2UpdatesStorage(l1);
  testLog.getLog().info(JSON.stringify(updatesAfter));

  // eslint-disable-next-line no-console
  console.log(updatesAfter);
  // eslint-disable-next-line no-console
  console.log(updatesBefore);

  testLog.getLog().info(depositor.keyRingPair.address);
  let ferrier;
  if (withFerry) {
    ferrier = await Ferry.setupFerrier(
      l1,
      getL1(l1)?.contracts?.native.address!,
    );
  }
  const assetId = await getAssetIdFromErc20(
    getL1(l1)?.contracts.native.address!,
    l1,
  );
  const pWaiter = waitForBalanceChange(
    depositor.keyRingPair.address,
    60,
    assetId,
  );
  if (withFerry) {
    const diffStorage = diff(
      JSON.parse(JSON.stringify(updatesBefore)),
      JSON.parse(JSON.stringify(updatesAfter)),
    );
    testLog.getLog().info(JSON.stringify(diffStorage));
    const newDeposit = diffStorage[0]!.changes![0].value!;
    const deposit = new L2Update(getApi())
      .withDeposit(
        newDeposit.requestId.id,
        depositor.keyRingPair.address,
        //@ts-ignore
        getL1(l1)!.contracts.native.address,
        new BN(amount.toString()),
        newDeposit.timeStamp,
        new BN(newDeposit.ferryTip.toString()),
      )
      .buildParams()
      .pendingDeposits[0] as unknown as PalletRolldownMessagesDeposit;

    const res = await Ferry.ferryThisDeposit(ferrier!, deposit, l1);
    expectExtrinsicSucceed(res);
    const userBalanceExpectedAmount = new BN(amount.toString()).sub(
      new BN(newDeposit.ferryTip.toString()),
    );
    let balance: OrmlTokensAccountData;
    if (l1 === "EthAnvil") {
      balance = await depositor.getBalanceForEthToken(
        getL1(l1)!.contracts.native.address,
      );
    } else {
      balance = await depositor.getBalanceForArbToken(
        getL1(l1)!.contracts.native.address,
      );
    }
    expect(balance.free.toString()).toEqual(
      userBalanceExpectedAmount.toString(),
    );
  }
  return await pWaiter;
}

export async function waitForBatchWithRequest(
  requestId: bigint,
  testChain: TestChain,
  maxEthBlocks = nToBigInt(20),
) {
  const publicClient = getPublicClient(testChain.name as unknown as L1Type);
  let currBlock = await publicClient.getBlockNumber();
  const maxBlock = currBlock + maxEthBlocks;
  while (currBlock < maxBlock) {
    const range = await publicClient
      .readContract({
        address: testChain.contracts.rollDown.address,
        abi: abi,
        functionName: "find_l2_batch",
        args: [requestId],
      })
      .then((res) => {
        testLog.getLog().info(res);
        return res;
      })
      .catch((err) => {
        //@ts-ignore
        testLog.getLog().info(err.shortMessage);
      });
    if (range) {
      //@ts-ignore
      return { start: range.start, end: range.end };
    }
    currBlock = await publicClient.getBlockNumber();
    await sleep(5000);
  }
  return { start: 0, end: 0 };
}
export function waitForNClosedWithdrawals(publicClient: PublicClient, num = 1) {
  let cont = 0;
  return new Promise((resolve, _) => {
    publicClient.watchContractEvent({
      abi: abi,
      address: ROLL_DOWN_CONTRACT_ADDRESS,
      eventName: "WithdrawalClosed",
      onLogs: async (logs: any) => {
        for (const log of logs) {
          cont += 1;
          // @ts-ignore
          testLog.getLog().info(JSON.stringify(log));
          if (num >= cont) {
            resolve(log);
          }
        }
      },
    });
  });
}
