import { ApiPromise, WsProvider } from "@polkadot/api";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars } from "./utils";

export let api: ApiPromise | null = null;

const { chainUri: envUri } = getEnvironmentRequiredVars();
export const getApi = () => {
  if (!api) {
    throw new Error("Api not initialized");
  }
  return api;
};

export const initApi = async (uri = "") => {
  // const wsProvider = new WsProvider(process.env.API_URL || 'ws://mangata-node:9944')
  if (!uri) {
    uri = envUri;
  }
  testLog.getLog().info(`TEST_INFO: Running test in ${uri}`);
  const wsProvider = new WsProvider(uri);
  api = await ApiPromise.create({
    provider: wsProvider,
    rpc: {
      xyk: {
        calculate_buy_price: {
          description: "",
          params: [
            {
              name: "input_reserve",
              type: "Balance",
            },
            {
              name: "output_reserve",
              type: "Balance",
            },
            {
              name: "sell_amount",
              type: "Balance",
            },
          ],
          type: "RpcResult<Balance>",
        },
        calculate_sell_price: {
          description: "",
          params: [
            {
              name: "input_reserve",
              type: "Balance",
            },
            {
              name: "output_reserve",
              type: "Balance",
            },
            {
              name: "sell_amount",
              type: "Balance",
            },
          ],
          type: "RpcResult<Balance>",
        },
        get_burn_amount: {
          description: "",
          params: [
            {
              name: "first_asset_id",
              type: "TokenId",
            },
            {
              name: "second_asset_id",
              type: "TokenId",
            },
            {
              name: "liquidity_asset_amount",
              type: "Balance",
            },
          ],
          type: "RPCAmountsResult<Balance>",
        },
        calculate_sell_price_id: {
          description: "",
          params: [
            {
              name: "sold_token_id",
              type: "TokenId",
            },
            {
              name: "bought_token_id",
              type: "TokenId",
            },
            {
              name: "sell_amount",
              type: "Balance",
            },
          ],
          type: "RpcResult<Balance>",
        },
        calculate_buy_price_id: {
          description: "",
          params: [
            {
              name: "sold_token_id",
              type: "TokenId",
            },
            {
              name: "bought_token_id",
              type: "TokenId",
            },
            {
              name: "buy_amount",
              type: "Balance",
            },
          ],
          type: "RpcResult<Balance>",
        },
      },
    },
    types: {
      SeedType: {
        seed: "[u8;32]",
        proof: "[u8;64]",
      },
      CurrencyIdOf: "u32",
      CurrencyId: "u32",
      Balance: "u128",
      App: {
        _enum: ["ETH", "ERC20"],
      },

      RpcResult: {
        price: "Balance",
      },
      RPCAmountsResult: {
        firstAssetAmount: "Balance",
        secondAssetAmount: "Balance",
      },

      // mapping the actual specified address format
      Address: "AccountId",
      // mapping the lookup
      LookupSource: "AccountId",

      AssetInfo: {
        name: "Option<Vec<u8>>",
        symbol: "Option<Vec<u8>>",
        description: "Option<Vec<u8>>",
        decimals: "Option<u32>",
      },

      AppId: "[u8; 20]",
      Message: {
        payload: "Vec<u8>",
        verification: "VerificationInput",
      },
      VerificationInput: {
        _enum: {
          Basic: "VerificationBasic",
          None: null,
        },
      },
      VerificationBasic: {
        blockNumber: "u64",
        eventIndex: "u32",
      },
      TokenId: "u32",
      BridgedAssetId: "H160",
      AssetAccountData: {
        free: "U256",
      },
      EthereumHeader: {
        parentHash: "H256",
        timestamp: "u64",
        number: "u64",
        author: "H160",
        transactionsRoot: "H256",
        ommersHash: "H256",
        extraData: "Vec<u8>",
        stateRoot: "H256",
        receiptsRoot: "H256",
        logBloom: "Bloom",
        gasUsed: "U256",
        gasLimit: "U256",
        difficulty: "U256",
        seal: "Vec<Vec<u8>>",
      },
      Bloom: {
        _: "[u8; 256]",
      },
      BalanceLock: {
        id: "[u8; 8]",
        amount: "Balance",
      },
      Valuation: {
        liquidity_token_amount: "Balance",
        mng_valuation: "Balance",
      },
    },
  });
  testLog.getLog().debug(api.genesisHash.toHex());
  return api;
};
