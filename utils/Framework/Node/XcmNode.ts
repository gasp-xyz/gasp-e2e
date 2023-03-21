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

export class XcmNode {
  api: ApiPromise;
  chain: ChainSpec;

  xTokenTransfer(
    toChain: ChainId,
    assetId: AssetSpec,
    amount: BN,
    toUser: User
  ): any {
    assert(ChainSpecs.has(toChain));
    const target = ChainSpecs.get(toChain)!;
    assert(target.foreign.has(assetId));
    assert(this.chain.assets.has(assetId));
    const asset = this.chain.assets.get(assetId)!;

    return this.api.tx.xTokens.transferMultiasset(
      {
        V1: {
          id: {
            Concrete: asset.location,
          },
          fun: {
            Fungible: amount,
          },
        },
      },
      {
        V1: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: target.parachain },
              {
                AccountId32: {
                  network: "Any",
                  id: toUser.keyRingPair.publicKey,
                },
              },
            ],
          },
        },
      },
      {
        Limited: TRANSFER_INSTRUCTIONS * target.unitCostWeight,
      }
    );
  }

  constructor(api: ApiPromise, chainId: ChainId) {
    this.api = api;
    assert(ChainSpecs.has(chainId));
    this.chain = ChainSpecs.get(chainId)!;
  }

  static async create(uri: string, chainId: ChainId): Promise<XcmNode> {
    const provider = new WsProvider(uri);
    const api = await ApiPromise.create({
      provider: provider,
    });
    return new XcmNode(api!, chainId);
  }
}