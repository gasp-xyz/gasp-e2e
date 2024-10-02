import { Chain, defineChain } from "viem";

export interface TestChain extends Chain {
  contracts: {
    rollDown: {
      address: `0x{string}`;
    };
    dummyErc20: {
      address: `0x{string}`;
    };
    native: {
      address: `0x{string}`;
    };
  };
  gaspName: string;
}
export const EthAnvil: TestChain = defineChain({
  id: 31_337,
  name: "EthAnvil",
  nativeCurrency: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
      webSocket: ["ws://127.0.0.1:8545"],
    },
  },
  contracts: {
    rollDown: {
      address: "0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc",
    },
    dummyErc20: {
      address: "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F",
    },
    native: {
      address: "0x0000000000000000000000000000000000000001",
    },
  },
  gaspName: "Ethereum",
}) as any as TestChain;
export const ArbAnvil: TestChain = defineChain({
  id: 31_337,
  name: "ArbAnvil",
  nativeCurrency: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8546"],
      webSocket: ["ws://127.0.0.1:8546"],
    },
  },
  contracts: {
    rollDown: {
      address: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    },
    dummyErc20: {
      address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    },
    native: {
      address: "0x0000000000000000000000000000000000000001",
    },
  },
  gaspName: "Arbitrum",
}) as any as TestChain;

export type L1Type = "EthAnvil" | "ArbAnvil";

export function getL1(type: L1Type) {
  switch (type) {
    case "EthAnvil":
      return EthAnvil;
    case "ArbAnvil":
      return ArbAnvil;
    default:
      return undefined;
  }
}
export function getL1FromName(name: string): L1Type | undefined {
  switch (name.toLowerCase()) {
    case "ethereum":
      return "EthAnvil";
    case "anvil":
      return "ArbAnvil";
    default:
      return undefined;
  }
}
