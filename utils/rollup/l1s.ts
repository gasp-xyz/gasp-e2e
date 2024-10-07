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
      address: "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f",
    },
    dummyErc20: {
      address: "0xFD471836031dc5108809D173A067e8486B9047A3",
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
      address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    },
    dummyErc20: {
      address: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
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
      throw Error("unexpected name");
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
