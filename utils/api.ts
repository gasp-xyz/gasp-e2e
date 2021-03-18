import { ApiPromise, WsProvider } from '@polkadot/api'

export let api: ApiPromise | null = null

export const getApi = () => {
  if (!api) {
    throw new Error('Api not initialized')
  }
  return api
}

export const initApi = async () => {
  // const wsProvider = new WsProvider(process.env.API_URL || 'ws://mangata-node:9944')
  const wsProvider = new WsProvider('ws://127.0.0.1:9944')
  api = await ApiPromise.create({
    provider: wsProvider,
    rpc: {
      xyk: {
        calculate_buy_price: {
          description: '',
          params: [
            {
              name: 'input_reserve',
              type: 'Balance',
            },
            {
              name: 'output_reserve',
              type: 'Balance',
            },
            {
              name: 'sell_amount',
              type: 'Balance',
            },
          ],
          type: 'RpcResult<Balance>',
        },
        calculate_sell_price: {
          description: '',
          params: [
            {
              name: 'input_reserve',
              type: 'Balance',
            },
            {
              name: 'output_reserve',
              type: 'Balance',
            },
            {
              name: 'sell_amount',
              type: 'Balance',
            },
          ],
          type: 'RpcResult<Balance>',
        },
      },
    },
    types: {

			Balance: 'u128',

			RpcResult: {
				price: 'Balance'
			},
			
      // mapping the actual specified address format
      Address: 'AccountId',
      // mapping the lookup
      LookupSource: 'AccountId',

      AssetInfo: {
        name: 'Option<Vec<u8>>',
        symbol: 'Option<Vec<u8>>',
        description: 'Option<Vec<u8>>',
        decimals: 'Option<u32>',
      },

      AppId: '[u8; 20]',
      Message: {
        payload: 'Vec<u8>',
        verification: 'VerificationInput',
      },
      VerificationInput: {
        _enum: {
          Basic: 'VerificationBasic',
          None: null,
        },
      },
      VerificationBasic: {
        blockNumber: 'u64',
        eventIndex: 'u32',
      },
      TokenId: 'H160',
      BridgedAssetId: 'H160',
      AssetAccountData: {
        free: 'U256',
      },
      EthereumHeader: {
        parentHash: 'H256',
        timestamp: 'u64',
        number: 'u64',
        author: 'H160',
        transactionsRoot: 'H256',
        ommersHash: 'H256',
        extraData: 'Vec<u8>',
        stateRoot: 'H256',
        receiptsRoot: 'H256',
        logBloom: 'Bloom',
        gasUsed: 'U256',
        gasLimit: 'U256',
        difficulty: 'U256',
        seal: 'Vec<Vec<u8>>',
      },
      Bloom: {
        _: '[u8; 256]',
      },
    },
  })
  // console.log(api.genesisHash.toHex())
  // return api
}
