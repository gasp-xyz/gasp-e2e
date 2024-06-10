import { Chain, defineChain } from "viem";
interface TestChain extends Chain {
  contracts: {
    rollDown: {
      address: `0x{string}`;
    };
    dummyErc20: {
      address: `0x{string}`;
    };
  };
  gaspName: string;
}
export const EthAnvil: TestChain = /*#__PURE__*/ defineChain({
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
      address: "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3",
    },
    dummyErc20: {
      address: "0xCD8a1C3ba11CF5ECfa6267617243239504a98d90",
    },
  },
  gaspName: "Ethereum",
}) as any as TestChain;
export const ArbAnvil: TestChain = /*#__PURE__*/ defineChain({
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
      address: "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3",
    },
    dummyErc20: {
      address: "0xCD8a1C3ba11CF5ECfa6267617243239504a98d90",
    },
  },
  gaspName: "Arbitrum",
}) as any as TestChain;

export type L1Type = "EthAnvil" | "ArbAnvil";

export function getL1(type: L1Type) {
  switch (type) {
    case "EthAnvil":
      console.info(JSON.stringify(EthAnvil));
      return EthAnvil;
    case "ArbAnvil":
      console.info(JSON.stringify(ArbAnvil));
      return ArbAnvil;
    default:
      return undefined;
  }
}
