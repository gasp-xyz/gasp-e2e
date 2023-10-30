import { api, Extrinsic } from "./setup";
import {
  AssetSpec,
  ChainId,
  ChainSpecs,
  TRANSFER_INSTRUCTIONS,
  WEIGHT_IN_SECONDS,
} from "./ChainSpecs";
import { BN } from "@polkadot/util";
import { User } from "./User";

export class XToken {
  static xcmTransferFee(toChain: ChainId, assetId: AssetSpec): BN {
    expect(ChainSpecs.has(toChain));
    const chain = ChainSpecs.get(toChain)!;
    expect(chain.assets.has(assetId));
    const asset = chain.assets.get(assetId)!;

    return new BN(chain.unitCostWeight * TRANSFER_INSTRUCTIONS)
      .mul(asset.fps)
      .div(WEIGHT_IN_SECONDS);
  }

  static transfer(
    toChain: ChainId,
    assetId: AssetSpec,
    amount: BN,
    toUser: User,
  ): Extrinsic {
    expect(ChainSpecs.has(toChain));
    const chain = ChainSpecs.get(toChain)!;
    expect(chain.assets.has(assetId));

    return api.tx.xTokens.transferMultiasset(
      {
        V2: {
          id: {
            Concrete: assetId.location,
          },
          fun: {
            Fungible: amount,
          },
        },
      },
      {
        V2: {
          parents: 1,
          interior: {
            X2: [
              { Parachain: chain.parachain },
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
      { Limited: TRANSFER_INSTRUCTIONS * chain.unitCostWeight },
    );
  }
}
