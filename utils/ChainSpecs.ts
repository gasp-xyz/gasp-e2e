import { BN_TEN, BN_ZERO } from "gasp-sdk";
import { BN, BN_HUNDRED, BN_THOUSAND } from "@polkadot/util";
import { ApiPromise } from "@polkadot/api";

export const TRANSFER_INSTRUCTIONS = 4;
export const WEIGHT_IN_SECONDS = new BN(1_000_000_000_000);

export interface ChainSpec {
  unitCostWeight: number;
  parachain: number;
  assets: Map<AssetSpec, AssetMeta>;
  foreign: Map<AssetSpec, AssetMeta>;
}

export interface AssetSpec {
  symbol: string;
  decimals: number;
  location: object;
  unit: BN;
}

interface AssetMeta {
  fps: BN;
  ed: BN;
  location: object;
}

export enum ChainId {
  Mg,
  Tur,
  Bifrost,
  Statemine,
}

export class AssetId {
  static Tur: AssetSpec = {
    symbol: "TUR",
    decimals: 10,
    location: { parents: 1, interior: { X1: { Parachain: 2114 } } },
    unit: BN_TEN.pow(new BN(10)),
  };
  static TurV3: AssetSpec = {
    symbol: "TUR",
    decimals: 10,
    location: { parents: 1, interior: { X1: { Parachain: 2114 } } },
    unit: BN_TEN.pow(new BN(10)),
  };

  static Mgx: AssetSpec = {
    symbol: "MGX",
    decimals: 18,
    location: {
      parents: 1,
      interior: { X2: [{ Parachain: 2110 }, { GeneralKey: "0x00000000" }] },
    },
    unit: BN_TEN.pow(new BN(18)),
  };
  static async getLocationFromChain(symbol: string, api: ApiPromise) {
    const entries = await api.query.assetRegistry.metadata.entries();
    const asset = entries.filter((entry) => {
      const elem = entry[1];
      const name = api.createType(
        "Vec<u8>",
        JSON.parse(JSON.stringify(elem)).symbol,
      );
      return name.toHuman() === symbol;
    })[0];
    return JSON.parse(JSON.stringify(asset[1].toHuman())).location;
  }
  static Bnc: AssetSpec = {
    symbol: "BNC",
    decimals: 12,
    location: {
      parents: 1,
      interior: { X2: [{ Parachain: 2001 }, { GeneralKey: "0x0001" }] },
    },
    unit: BN_TEN.pow(new BN(12)),
  };
  static ImbueBncV3: AssetSpec = {
    symbol: "BNC",
    decimals: 12,
    location: {
      parents: 0,
      interior: {
        X1: [
          {
            GeneralKey: {
              length: 2,
              data: "0x0001000000000000000000000000000000000000000000000000000000000000",
            },
          },
        ],
      },
    },
    unit: BN_TEN.pow(new BN(12)),
  };
  static BncV3: AssetSpec = {
    symbol: "BNC",
    decimals: 12,
    location: {
      parents: 1,
      interior: {
        X2: [
          { Parachain: 2001 },
          {
            GeneralKey: {
              length: 2,
              data: "0x0001000000000000000000000000000000000000000000000000000000000000",
            },
          },
        ],
      },
    },
    unit: BN_TEN.pow(new BN(12)),
  };

  static USDt: AssetSpec = {
    symbol: "USDt",
    decimals: 6,
    location: {
      parents: 1,
      interior: {
        X3: [
          { Parachain: 1000 },
          { PalletInstance: 50 },
          { GeneralIndex: 1984 },
        ],
      },
    },
    unit: BN_TEN.pow(new BN(6)),
  };
}

export const ChainSpecs = new Map<ChainId, ChainSpec>([
  [
    ChainId.Tur,
    {
      unitCostWeight: 1_000_000_000,
      parachain: 2114,
      assets: new Map([
        [
          AssetId.Tur,
          {
            fps: new BN(416_000_000_000),
            ed: AssetId.Tur.unit.mul(BN_TEN),
            location: AssetId.Tur.location,
          },
        ],
      ]),
      foreign: new Map(),
    },
  ],
  [
    ChainId.Mg,
    {
      unitCostWeight: 150_000_000,
      parachain: 2110,
      assets: new Map(),
      foreign: new Map([
        [
          AssetId.Tur,
          {
            fps: new BN(537_600_000_000),
            ed: BN_ZERO,
            location: AssetId.Tur.location,
          },
        ],
        [
          AssetId.TurV3,
          {
            fps: new BN(537_600_000_000),
            ed: BN_ZERO,
            location: AssetId.TurV3.location,
          },
        ],
        [
          AssetId.Bnc,
          {
            fps: new BN(43008000000000),
            ed: BN_ZERO,
            location: AssetId.Bnc.location,
          },
        ],
        [
          AssetId.ImbueBncV3,
          {
            fps: new BN(43008000000000),
            ed: BN_ZERO,
            location: AssetId.BncV3.location,
          },
        ],
        [
          AssetId.BncV3,
          {
            fps: new BN(43008000000000),
            ed: BN_ZERO,
            location: AssetId.BncV3.location,
          },
        ],
        [
          AssetId.USDt,
          {
            fps: new BN(13440000),
            ed: BN_ZERO,
            location: AssetId.USDt.location,
          },
        ],
      ]),
    },
  ],
  [
    ChainId.Bifrost,
    {
      unitCostWeight: 200_000_000,
      parachain: 2001,
      assets: new Map([
        [
          AssetId.Bnc,
          {
            fps: new BN(9360000000000),
            ed: AssetId.Bnc.unit.div(BN_HUNDRED),
            location: {
              parents: 0,
              interior: { X1: { GeneralKey: "0x0001" } },
            },
          },
        ],
        [
          AssetId.BncV3,
          {
            fps: new BN(9360000000000),
            ed: AssetId.BncV3.unit.div(BN_HUNDRED),
            location: {
              parents: 0,
              interior: {
                X1: {
                  GeneralKey: {
                    length: 2,
                    data: "0x0001000000000000000000000000000000000000000000000000000000000000",
                  },
                },
              },
            },
          },
        ],
        [
          AssetId.ImbueBncV3,
          {
            fps: new BN(9360000000000),
            ed: AssetId.ImbueBncV3.unit.div(BN_HUNDRED),
            location: {
              parents: 0,
              interior: {
                X1: {
                  GeneralKey: {
                    length: 2,
                    data: "0x0001000000000000000000000000000000000000000000000000000000000000",
                  },
                },
              },
            },
          },
        ],
      ]),
      foreign: new Map(),
    },
  ],
  [
    ChainId.Statemine,
    {
      unitCostWeight: 1_000_000_000,
      parachain: 1000,
      assets: new Map([
        [
          AssetId.USDt,
          {
            fps: new BN(1),
            ed: AssetId.USDt.unit.div(BN_THOUSAND),
            location: {
              parents: 0,
              interior: {
                X2: [{ PalletInstance: 50 }, { GeneralIndex: 1984 }],
              },
            },
          },
        ],
      ]),
      foreign: new Map(),
    },
  ],
]);
