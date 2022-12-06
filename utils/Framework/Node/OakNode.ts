import { ApiPromise, WsProvider } from "@polkadot/api";
import {
  AssetSpec,
  ChainId,
  ChainSpecs,
  TRANSFER_INSTRUCTIONS,
} from "../../ChainSpecs";
import { BN } from "@polkadot/util";
import { User } from "../../User";

export class OakApi {
  api: ApiPromise;

  addChainCurrencyData(paraId: number, currencyId: number): any {
    return this.api.tx.xcmpHandler.addChainCurrencyData(paraId, currencyId, {
      native: false,
      feePerSecond: 537_600_000_000,
      instructionWeight: 150_000_000 * 6,
    });
  }

  xTokenTransfer(
    toChain: ChainId,
    assetId: AssetSpec,
    amount: BN,
    toUser: User
  ): any {
    expect(ChainSpecs.has(toChain));
    const chain = ChainSpecs.get(toChain)!;
    expect(chain.assets.has(assetId));

    return this.api.tx.xTokens.transferMultiasset(
      {
        V1: {
          id: {
            Concrete: assetId.location,
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
      TRANSFER_INSTRUCTIONS * chain.unitCostWeight
    );
  }

  constructor(api: ApiPromise) {
    this.api = api;
  }

  static async create(uri: string): Promise<OakApi> {
    const provider = new WsProvider(uri);
    const api = await ApiPromise.create({
      provider: provider,
      rpc: {
        automationTime: {
          generateTaskId: {
            description: "Getting task ID given account ID and provided ID",
            params: [
              {
                name: "accountId",
                type: "AccountId",
              },
              {
                name: "providedId",
                type: "Text",
              },
            ],
            type: "Hash",
          },
          getTimeAutomationFees: {
            description: "Retrieve automation fees",
            params: [
              {
                name: "action",
                type: "AutomationAction",
              },
              {
                name: "executions",
                type: "u32",
              },
            ],
            type: "Balance",
          },
          calculateOptimalAutostaking: {
            description: "Calculate the optimal period to restake",
            params: [
              {
                name: "principal",
                type: "i128",
              },
              {
                name: "collator",
                type: "AccountId",
              },
            ],
            type: "AutostakingResult",
          },
          getAutoCompoundDelegatedStakeTaskIds: {
            description: "Return autocompounding tasks by account",
            params: [
              {
                name: "account_id",
                type: "AccountId",
              },
            ],
            type: "Vec<Hash>",
          },
        },
        xcmpHandler: {
          fees: {
            description:
              "Return XCMP fee for a automationTime.scheduleXCMPTask",
            params: [
              {
                name: "encoded_xt",
                type: "Bytes",
              },
            ],
            type: "u64",
          },
          crossChainAccount: {
            description:
              "Find OAK's cross chain access account from an account",
            params: [
              {
                name: "account_id",
                type: "AccountId32",
              },
            ],
            type: "AccountId32",
          },
        },
      },
      types: {
        AutomationAction: {
          _enum: [
            "Notify",
            "NativeTransfer",
            "XCMP",
            "AutoCompoundDelgatedStake",
          ],
        },
        AutostakingResult: {
          period: "i32",
          apy: "f64",
        },
      },
    });
    return new OakApi(api!);
  }
}
