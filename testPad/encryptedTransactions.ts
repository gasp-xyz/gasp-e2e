/* eslint-disable no-console */
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/keyring";
import { utils, PrivateKey, PublicKey } from "eciesjs";

function sleep_ms(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function main() {
  // Instantiate the API
  const wsProvider = new WsProvider("ws://127.0.0.1:9944");
  const api = await ApiPromise.create({
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
          type: "Balance",
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
          type: "Balance",
        },
      },
    },
    types: {
      CurrencyId: "u32",
      Balance: "u128",
      App: {
        _enum: ["ETH", "ERC20"],
      },
      RpcResult: {
        price: "Balance",
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
      AccountData: {
        free: "u128",
        reserved: "u128",
        frozen: "u128",
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
      SeedType: {
        seed: "[u8;32]",
        proof: "[u8;64]",
      },
      Bloom: {
        _: "[u8; 256]",
      },
      ShufflingSeed: {
        seed: "H256",
        proof: "H512",
      },
      Header: {
        parentHash: "Hash",
        number: "Compact<BlockNumber>",
        stateRoot: "Hash",
        extrinsicsRoot: "Hash",
        digest: "Digest",
        seed: "ShufflingSeed",
      },
      VectorOfCalls: "Vec<Call>",
      VectorOfVecu8: "Vec<Vec<u8>>",
      AuthorityId: "[u8; 33]",
    },
  });
  //const api = Mangata.getInstance("ws://127.0.0.1:9944").getApi();
  await api.isReady;
  // Constuct the keyring after the API (crypto has an async init)
  const keyring = new Keyring({ type: "sr25519" });
  // Add Alice to our keyring with a hard-deived path (empty phrase, so uses dev)
  const alice = keyring.addFromUri("//Alice");
  const ferdie = keyring.addFromUri("//Ferdie");
  // fetch all keys from ETX storage
  const key_map = JSON.parse(
    (await api.query.encryptedTransactions.keyMap()).toString()
  );
  const alice_pub_key = key_map[alice.address];
  const vector_of_calls = api.createType("Vec<Call>", [
    api.tx.tokens.transfer(ferdie.address, 0, 7e15),
    //api?.tx.staking.chill(),
  ]);
  // let tx_call = api.tx.tokens.transfer(ferdie.address, 0, 33E12)
  const tx_call = vector_of_calls;
  /// thats gonna be chaged a little
  ///  your private key + builder/executore public key  = encryption key
  //
  const secret_for_dummy_key = Uint8Array.from(
    new Array(utils.getValidSecret().length - 1).fill(0).concat(1)
  );
  /// secret key is [0,0,0,0,0, ..., 1] len (33)
  const secret_for_dummy_key_hex =
    Buffer.from(secret_for_dummy_key).toString("hex");
  const dummy_private_key = PrivateKey.fromHex(secret_for_dummy_key_hex);
  const receiverPK = PublicKey.fromHex(alice_pub_key);
  //// final encryption key
  const user_aes_key = dummy_private_key.encapsulate(receiverPK);
  const singly_encrypted = utils.aesEncrypt(
    user_aes_key,
    Buffer.from(tx_call.toU8a())
  );
  // could be done with other collator key (ex. BOB)
  const doubly_encrypted = utils.aesEncrypt(user_aes_key, singly_encrypted);
  console.log(`call ${tx_call.toU8a()}`);
  console.log(`singly encrypted ${Array.from(singly_encrypted)}`);
  console.log(`doubly encrypted ${Array.from(doubly_encrypted)}`);
  const call = Array.from(doubly_encrypted);
  // nonce most likely will be removed but should be unique for every transaction
  const tx = api.tx.encryptedTransactions.submitDoublyEncryptedTransaction(
    call,
    1,
    5000000000,
    alice.address,
    alice.address
  );
  console.log(`TX: ${await tx.signAndSend(alice)}`);
  await api.rpc.chain.subscribeNewHeads(async (lastHeader) => {
    const currentBlockEvents = await api.query.system.events.at(
      lastHeader.hash
    );
    console.log("!!!!!! EVENTS !!!!!!");
    // console.log(currentBlockEvents.toHuman())
    currentBlockEvents.forEach(
      ({ phase, event: { data, method, section } }) => {
        console.info(`${section}::${method} : ${data}`);
      }
    );
    // currentBlockEvents.forEach( (e) => {
    //     console.log(`${e.event.method} => ${e.event.data}`)}
    // );
  });
  while (true) {
    await sleep_ms(100);
  }
}
main()
  .catch(console.error)
  .finally(() => process.exit());
