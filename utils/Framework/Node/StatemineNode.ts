import { ApiPromise, WsProvider } from "@polkadot/api";
import { BN } from "@polkadot/util";
import assert from "assert";
import {
  AssetSpec,
  ChainId,
  ChainSpec,
  ChainSpecs,
  TRANSFER_INSTRUCTIONS,
} from "../../ChainSpecs";
import { User } from "../../User";

export class StatemineNode {
  api: ApiPromise;
  chain: ChainSpec;

  xTokenTransfer(
    toChain: ChainId,
    assetId: AssetSpec,
    amount: BN,
    toUser: User,
  ): any {
    assert(ChainSpecs.has(toChain));
    const target = ChainSpecs.get(toChain)!;
    assert(target.foreign.has(assetId));
    assert(this.chain.assets.has(assetId));
    const asset = this.chain.assets.get(assetId)!;

    return this.api.tx.polkadotXcm.limitedReserveTransferAssets(
      {
        V2: {
          interior: {
            X1: {
              Parachain: target.parachain,
            },
          },
          parents: 1,
        },
      },
      {
        V2: {
          interior: {
            X1: {
              AccountId32: {
                id: toUser.keyRingPair.publicKey,
                network: {
                  Any: "",
                },
              },
            },
          },
          parents: 0,
        },
      },
      {
        V2: [
          {
            fun: {
              Fungible: amount,
            },
            id: {
              Concrete: asset.location,
            },
          },
        ],
      },
      0,
      { Limited: TRANSFER_INSTRUCTIONS * target.unitCostWeight },
    );
  }

  constructor(api: ApiPromise, chainId: ChainId) {
    this.api = api;
    assert(ChainSpecs.has(chainId));
    this.chain = ChainSpecs.get(chainId)!;
  }

  static async create(uri: string, chainId: ChainId): Promise<StatemineNode> {
    const provider = new WsProvider(uri);
    const api = await ApiPromise.create({
      provider: provider,
    });
    return new StatemineNode(api!, chainId);
  }
}
