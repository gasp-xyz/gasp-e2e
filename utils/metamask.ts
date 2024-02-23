/* eslint-disable no-console */
import { blake2AsU8a } from "@polkadot/util-crypto";
import { hexToU8a, isNumber, objectSpread, u8aToHex } from "@polkadot/util";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { GenericExtrinsic } from "@polkadot/types";
import { AnyTuple } from "@polkadot/types/types";

const eth_sig_utils = require("@metamask/eth-sig-util");
const eth_util = require("ethereumjs-util");

function makeSignOptions(api: any, partialOptions: any, extras: any) {
  return objectSpread(
    { blockHash: api.genesisHash, genesisHash: api.genesisHash },
    partialOptions,
    extras,
    {
      runtimeVersion: api.runtimeVersion,
      signedExtensions: api.registry.signedExtensions,
      version: api.extrinsicType,
    },
  );
}

function makeEraOptions(
  api: any,
  registry: any,
  partialOptions: any,
  signingInfo: any,
) {
  if (!signingInfo.header) {
    if (partialOptions.era && !partialOptions.blockHash) {
      throw new Error(
        "Expected blockHash to be passed alongside non-immortal era options",
      );
    }
    if (isNumber(partialOptions.era)) {
      // since we have no header, it is immortal, remove any option overrides
      // so we only supply the genesisHash and no era to the construction
      delete partialOptions.era;
      delete partialOptions.blockHash;
    }
    return makeSignOptions(api, partialOptions, signingInfo.nonce);
  }
  return makeSignOptions(api, partialOptions, {
    blockHash: signingInfo.header.hash,
    era: registry.createTypeUnsafe("ExtrinsicEra", [
      {
        current: signingInfo.header.number,
        period: partialOptions.era || signingInfo.mortalLength,
      },
    ]),
    nonce: signingInfo.nonce,
  });
}

export async function signTxMetamask(
  extrinsic: GenericExtrinsic<AnyTuple>,
  ethAddress = "0x9428406f4f4b467B7F5B8d6f4f066dD9d884D24B",
  ethPrivateKey = "0x2faacaa84871c08a596159fe88f8b2d05cf1ed861ac3d963c4a15593420cf53f",
) {
  const api = await ApiPromise.create({
    provider: new WsProvider("ws://127.0.0.1:9946"),
    rpc: {
      metamask: {
        get_eip712_sign_data: {
          description: "",
          params: [
            {
              name: "call",
              type: "String",
            },
          ],
          type: "String",
        },
      },
    },
    types: {
      MultiSignature: {
        _enum: {
          Ed25519: "Ed25519Signature",
          Sr25519: "Sr25519Signature",
          Ecdsa: "EcdsaSignature",
          Eth: "EcdsaSignature",
        },
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
        count: "BlockNumber",
      },
    },
  });

  const tx = api.tx.tokens.transfer(
    "HWyLYmpW68JGJYoVJcot6JQ1CJbtUQeTdxfY1kUTsvGCB1r",
    0,
    1000,
  );

  const dotAddress = blake2AsU8a(hexToU8a(ethAddress)).toString();
  const options = {};
  const signingInfo = await api.derive.tx.signingInfo(
    dotAddress,
    // @ts-ignore
    options.nonce,
    // @ts-ignore
    options.era,
  );
  const eraOptions = makeEraOptions(api, api.registry, options, signingInfo);
  // @ts-ignore
  const tx_payload = tx.inner.signature.createPayload(tx.method, eraOptions);
  const raw_payload = tx_payload.toU8a({ method: true });
  // @ts-ignore
  const result = await api.rpc.metamask.get_eip712_sign_data(
    tx.toHex().slice(2),
  );
  console.log(JSON.stringify(result));
  const data = JSON.parse(result.toString());
  data.message.tx = u8aToHex(raw_payload).slice(2);

  const msg_sig = eth_sig_utils.signTypedData({
    privateKey: eth_util.toBuffer(ethPrivateKey),
    data: data,
    version: "V4",
  });
  console.log("Ok, signed typed data ");
  console.log("SIGNATURE = " + msg_sig);
  const created_signature = api.createType("MultiSignature", {
    Eth: hexToU8a(msg_sig),
  });
  console.log(tx_payload);
  console.log(msg_sig);
  // @ts-ignore
  extrinsic.addSignature(dotAddress, created_signature, tx_payload);
  await api.rpc.author.submitExtrinsic(extrinsic.toHex());
  console.log("Sent!!!");
}
