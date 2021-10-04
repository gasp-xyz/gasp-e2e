import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import * as eciesjs from 'eciesjs' ;

const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

async function main () {
  // Instantiate the API
  const wsProvider = new WsProvider('ws://127.0.0.1:9944')
  const api = await ApiPromise.create({
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
          type: 'Balance',
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
          type: 'Balance',
        },
      },
    },
    types: {
      CurrencyId: 'u32',
      Balance: 'u128',
      App: {
        _enum: [
          'ETH',
          'ERC20'
        ]
      },
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
      TokenId: 'u32',
      BridgedAssetId: 'H160',
      AccountData: {
        free: 'u128',
        reserved: 'u128',
        frozen: 'u128',
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
      SeedType: {
        seed: '[u8;32]',
        proof: '[u8;64]'
      },
      Bloom: {
        _: '[u8; 256]',
      },
      ShufflingSeed: {
        seed: 'H256',
        proof: 'H512'
      },
      Header: {
        parentHash: "Hash",
        number: "Compact<BlockNumber>",
        stateRoot: "Hash",
        extrinsicsRoot: "Hash",
        digest: "Digest",
        seed: "ShufflingSeed"
      },
      VectorOfCalls: 'Vec<Call>',
      VectorOfVecu8: 'Vec<Vec<u8>>',
      AuthorityId: '[u8; 33]'
    },
  })
  await api.isReady;

  // Constuct the keyring after the API (crypto has an async init)
  const keyring = new Keyring({ type: 'sr25519' });

  // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
  const alice = keyring.addFromUri('//Alice');
  const maciatko = keyring.addFromUri('//Maciatko');

  let key_map = await api.query.encryptedTransactions.keyMap();

  let keys_array = Array.from(key_map.values());
  let collator_accounts_array = Array.from(key_map.keys());

  let array_of_calls = [api.tx.tokens.transfer(BOB, 0, 12345), api.tx.tokens.transfer(maciatko.address, 0, 12345)]

  let vector_of_calls = api.createType('VectorOfCalls', array_of_calls);
  let scale_encoded_vector_of_calls = vector_of_calls.toU8a();

  let receiver_public_key_hex = Buffer.from(keys_array[0].toU8a()).toString('hex');
  let receiverPK = eciesjs.PublicKey.fromHex(receiver_public_key_hex);

  let secret_key_length_in_bits = eciesjs.utils.getValidSecret().length;
  let secret_for_dummy_key = Uint8Array.from(new Array(secret_key_length_in_bits - 1).fill(0).concat(1));
  let secret_for_dummy_key_hex = Buffer.from(secret_for_dummy_key).toString('hex');

  let dummy_private_key = eciesjs.PrivateKey.fromHex(secret_for_dummy_key_hex);
  
  let user_aes_key = dummy_private_key.encapsulate(receiverPK);

  let singly_encrypted = eciesjs.utils.aesEncrypt(user_aes_key, scale_encoded_vector_of_calls);

  let doubly_encrypted = eciesjs.utils.aesEncrypt(user_aes_key, singly_encrypted);

  let hexed_from_buffer_doubly_encrypted = Buffer.from(doubly_encrypted).toString('hex');
  console.log(hexed_from_buffer_doubly_encrypted);
  let prefixed_hexed_from_buffer_doubly_encrypted = "0x" + hexed_from_buffer_doubly_encrypted;

  let alice_nonce = await api.rpc.system.accountNextIndex( alice.address);
  console.log(alice_nonce);
  let calls_weight = 0;

  for (let call of array_of_calls){
    let call_weight = await call.paymentInfo(alice.address).then(info => info.weight);
    calls_weight = calls_weight + call_weight;
  };
  
  
  await api.tx.encryptedTransactions.submitDoublyEncryptedTransaction(prefixed_hexed_from_buffer_doubly_encrypted, alice_nonce, calls_weight, collator_accounts_array[0], collator_accounts_array[0] )
  .signAndSend(alice, {alice_nonce});

}

main().catch(console.error).finally(() => process.exit());
