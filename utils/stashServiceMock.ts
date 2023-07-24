import express, { Express } from "express";
import cors from "cors";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars } from "./utils";

const stashServiceMock: Express = express();
const port = 3000;
const localAddress = getEnvironmentRequiredVars().localAddress;

stashServiceMock.use(
  cors({
    origin: "*",
  })
);

stashServiceMock.get("/xcm/channels", (_req, res) => {
  // Replace this with your desired data
  const data = [
    {
      channelId: "1",
      name: "Kusama",
      status: "open",
      unitWeightCost: "",
      xcmTransferWeight: "298368000",
      url: "ws://" + localAddress + ":9944",
      xcmVersion: "V3",
      chainType: "relaychain",
    },
    {
      channelId: "1000",
      name: "Statemine",
      status: "open",
      unitWeightCost: "",
      xcmTransferWeight: "1171466000",
      url: "wss://statemine.api.onfinality.io/public-ws",
      xcmVersion: "V3",
      chainType: "parachain",
    },
    {
      channelId: "2001",
      name: "Bifrost",
      status: "open",
      unitWeightCost: "200000000",
      xcmTransferWeight: "800000000",
      url: "wss://bifrost-rpc.liebi.com/ws",
      xcmVersion: "V2",
      chainType: "parachain",
    },
    {
      channelId: "2023",
      name: "Moonriver",
      status: "open",
      unitWeightCost: "200000000",
      xcmTransferWeight: "800000000",
      url: "wss://wss.api.moonriver.moonbeam.network",
      xcmVersion: "V2",
      chainType: "parachain",
    },
    {
      channelId: "2114",
      name: "Turing",
      status: "open",
      unitWeightCost: "1000000000",
      xcmTransferWeight: "4000000000",
      url: "wss://rpc.turing.oak.tech",
      xcmVersion: "V3",
      chainType: "parachain",
    },
    {
      channelId: "2121",
      name: "Imbue",
      status: "open",
      unitWeightCost: "200000000",
      xcmTransferWeight: "800000000",
      url: "wss://imbue-kusama.imbue.network",
      xcmVersion: "V3",
      chainType: "parachain",
    },
  ];

  res.json(data);
});

stashServiceMock.get("/xcm/tokens", (_req, res) => {
  // Replace this with your desired data
  const data = [
    {
      tokenId: "11",
      name: "Imbue",
      symbol: "IMBU",
      decimals: "12",
      location: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2121,
            },
            {
              GeneralKey: {
                length: 2,
                data: "0x0096000000000000000000000000000000000000000000000000000000000000",
              },
            },
          ],
        },
      },
      feePerSec: "11700000000000",
      channelId: "2121",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "xTokens.transferMultiasset",
      balancePath: "system.account",
      existentialDeposit: "0.000001",
    },
    {
      tokenId: "14",
      name: "Bifrost Native Token",
      symbol: "BNC",
      decimals: "12",
      location: {
        parents: 0,
        interior: {
          X1: {
            GeneralKey: "0x0001",
          },
        },
      },
      feePerSec: "9360000000000",
      channelId: "2001",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "xTokens.transferMultiasset",
      balancePath: "system.account",
      existentialDeposit: "0.01",
    },
    {
      tokenId: "15",
      name: "Voucher KSM",
      symbol: "vKSM",
      decimals: "12",
      location: {
        parents: 0,
        interior: {
          X1: {
            GeneralKey: "0x0104",
          },
        },
      },
      feePerSec: "117000000000",
      channelId: "2001",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "xTokens.transferMultiasset",
      balancePath: "tokens.accounts",
      destinationTokenId: {
        vtoken: "ksm",
      },
      existentialDeposit: "0.0001",
    },
    {
      tokenId: "16",
      name: "Voucher Slot KSM",
      symbol: "vsKSM",
      decimals: "12",
      location: {
        parents: 0,
        interior: {
          X1: {
            GeneralKey: "0x0404",
          },
        },
      },
      feePerSec: "117000000000",
      channelId: "2001",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "xTokens.transferMultiasset",
      balancePath: "tokens.accounts",
      destinationTokenId: {
        vstoken: "ksm",
      },
      existentialDeposit: "0.0001",
    },
    {
      tokenId: "26",
      name: "Zenlink",
      symbol: "ZLK",
      decimals: "18",
      location: {
        parents: 0,
        interior: {
          X1: {
            GeneralKey: "0x0207",
          },
        },
      },
      feePerSec: "17550000000000000000",
      channelId: "2001",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "xTokens.transferMultiasset",
      balancePath: "tokens.accounts",
      destinationTokenId: {
        token: "zlk",
      },
      existentialDeposit: "0.000001",
    },
    {
      tokenId: "30",
      name: "USDT",
      symbol: "USDT",
      decimals: "6",
      location: {
        parents: 0,
        interior: {
          X2: [
            {
              PalletInstance: 50,
            },
            {
              GeneralIndex: 1984,
            },
          ],
        },
      },
      feePerSec: "",
      channelId: "1000",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "polkadotXcm.limitedReserveTransferAssets",
      balancePath: "assets.account",
      destinationTokenId: 1984,
      existentialDeposit: "0.001",
    },
    {
      tokenId: "31",
      name: "RMRK",
      symbol: "RMRK",
      decimals: "10",
      location: {
        parents: 0,
        interior: {
          X2: [
            {
              PalletInstance: 50,
            },
            {
              GeneralIndex: 8,
            },
          ],
        },
      },
      feePerSec: "",
      channelId: "1000",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "polkadotXcm.limitedReserveTransferAssets",
      balancePath: "assets.account",
      destinationTokenId: 8,
      existentialDeposit: "0.00001",
    },
    {
      tokenId: "4",
      name: "Kusama Native",
      symbol: "KSM",
      decimals: "12",
      location: {
        parents: 0,
        interior: "Here",
      },
      feePerSec: "537600000000",
      channelId: "1",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "xcmPallet.limitedReserveTransferAssets",
      balancePath: "system.account",
      existentialDeposit: "0.000333333",
    },
    {
      tokenId: "7",
      name: "Turing native token",
      symbol: "TUR",
      decimals: "10",
      location: {
        parents: 1,
        interior: {
          X1: {
            Parachain: 2114,
          },
        },
      },
      feePerSec: "416000000000",
      channelId: "2114",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "xTokens.transferMultiasset",
      balancePath: "system.account",
      existentialDeposit: "0.01",
    },
    {
      tokenId: "4",
      name: "Kusama Statemine",
      symbol: "KSM",
      decimals: "12",
      feePerSec: "",
      channelId: "1000",
      permissions: [],
      extrinsicPath: "polkadotXcm.limitedReserveTransferAssets",
      balancePath: "system.account",
      existentialDeposit: "0.000333333",
    },
    {
      tokenId: "0",
      name: "Mangata X",
      symbol: "MGX",
      decimals: "18",
      feePerSec: "",
      channelId: "2110",
      permissions: ["verified", "swap"],
      extrinsicPath: "xTokens.transfer",
      balancePath: "tokens.accounts",
      existentialDeposit: "0",
    },
    {
      tokenId: "11",
      name: "Imbue",
      symbol: "IMBU",
      decimals: "12",
      feePerSec: "26880000000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "14",
      name: "Bifrost Native Token",
      symbol: "BNC",
      decimals: "12",
      feePerSec: "43008000000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "15",
      name: "Voucher KSM",
      symbol: "vKSM",
      decimals: "12",
      feePerSec: "537600000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "16",
      name: "Voucher Slot KSM",
      symbol: "vsKSM",
      decimals: "12",
      feePerSec: "537600000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "26",
      name: "Zenlink",
      symbol: "ZLK",
      decimals: "18",
      feePerSec: "80640000000000000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "30",
      name: "USDT",
      symbol: "USDT",
      decimals: "6",
      feePerSec: "13440000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "4",
      name: "Kusama Native",
      symbol: "KSM",
      decimals: "12",
      feePerSec: "537600000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "7",
      name: "Turing native token",
      symbol: "TUR",
      decimals: "10",
      feePerSec: "537600000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "31",
      name: "RMRK",
      symbol: "RMRK",
      decimals: "10",
      feePerSec: "86016000000",
      channelId: "2110",
      permissions: ["xcm", "swap", "verified"],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "39",
      name: "MOVR",
      symbol: "MOVR",
      decimals: "18",
      feePerSec: "",
      channelId: "2110",
      permissions: [],
      extrinsicPath: "",
      balancePath: "",
      existentialDeposit: "",
    },
    {
      tokenId: "39",
      name: "MOVR",
      symbol: "MOVR",
      decimals: "18",
      location: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2023,
              PalletInstance: 10,
            },
          ],
        },
      },
      feePerSec: "2688000000000000000",
      channelId: "2023",
      permissions: [],
      extrinsicPath: "xTokens.transferMultiasset",
      balancePath: "system.account",
      existentialDeposit: "",
    },
  ];

  res.json(data);
});

stashServiceMock.listen(port, () => {
  testLog.getLog().info(`Server is running on port ${port}`);
});

export default stashServiceMock;
