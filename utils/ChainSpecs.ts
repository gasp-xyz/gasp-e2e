import { BN } from "@polkadot/util";
import { BN_TEN, BN_ZERO } from "@mangata-finance/sdk";

export const TRANSFER_INSTRUCTIONS = 4;
export const WEIGHT_IN_SECONDS = new BN(1_000_000_000_000);

interface ChainSpec {
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
}

export enum ChainId {
  Mg,
  Tur,
}

export class AssetId {
  static Tur: AssetSpec = {
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
          },
        ],
      ]),
    },
  ],
]);
