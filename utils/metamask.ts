/* eslint-disable no-console */
import {
  BN,
  hexToU8a,
  isHex,
  isNumber,
  objectSpread,
  u8aToHex,
} from "@polkadot/util";
import { ApiPromise, WsProvider } from "@polkadot/api";
import eth_util from "ethereumjs-util";
import eth_sig_utils from "@metamask/eth-sig-util";
import { testLog } from "./Logger";
import { ErrorData, MangataEventData, MangataGenericEvent } from "gasp-sdk";
import { getEnvironmentRequiredVars } from "./utils";
import { Optional } from "web3";

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
  tx: any,
  ethAddress: string,
  ethPrivateKey: string,
  txOptions: Optional<any, any> = { nonce: undefined },
): Promise<MangataGenericEvent[]> {
  //TODO: use sdk api when ready
  const api = await ApiPromise.create({
    provider: new WsProvider(getEnvironmentRequiredVars().chainUri),
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
      EthereumSignature: "EcdsaSignature",
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
  const extrinsic = api.createType(
    "Extrinsic",
    { method: tx.method },
    { version: tx.version },
  );

  const options = txOptions;

  const signingInfo = await api.derive.tx.signingInfo(
    // @ts-ignore
    ethAddress,
    // @ts-ignore
    options.nonce,
    // @ts-ignore
    options.era,
  );
  const eraOptions = makeEraOptions(api, api.registry, options, signingInfo);
  const tx_payload = extrinsic.inner.signature.createPayload(
    // @ts-ignore
    extrinsic.method,
    eraOptions,
  );
  const raw_payload = tx_payload.toU8a({ method: true });
  // @ts-ignore
  const result = await api.rpc.metamask.get_eip712_sign_data(
    tx.toHex().slice(2),
  );
  testLog.getLog().debug(JSON.stringify(result));
  const data = JSON.parse(result.toString());
  data.message.tx = u8aToHex(raw_payload).slice(2);
  testLog.getLog().info("Txhex " + data.message.tx);
  data.domain.chainId = 31337;
  const msg_sig = eth_sig_utils.signTypedData({
    privateKey: eth_util.toBuffer(ethPrivateKey),
    data: data,
    // @ts-ignore
    version: "V4",
  });
  testLog.getLog().debug("Ok, signed typed data ");
  testLog.getLog().info("SIGNATURE = " + msg_sig);
  const created_signature = api.createType(
    "EthereumSignature",
    hexToU8a(msg_sig),
  );
  testLog.getLog().info(tx_payload);
  testLog.getLog().debug(msg_sig);
  // @ts-ignore
  extrinsic.addSignature(ethAddress, created_signature, tx_payload);
  testLog.getLog().info("Sending tx");
  let txHash: any;
  try {
    txHash = await api.rpc.author.submitExtrinsic(extrinsic.toHex());
  } catch (e) {
    testLog.getLog().error("Error sending tx: " + e);
    throw e;
  }

  testLog.getLog().info("Tx sent " + txHash);
  let extrinsicResult: any;
  let counter = 10;
  return new Promise(async (resolve, reject) => {
    const unsub = await api.rpc.chain.subscribeNewHeads(
      async (header): Promise<void> => {
        if (counter <= 0) {
          unsub();
          reject("Timeout");
        }
        counter--;
        const currentBlock = await api.rpc.chain.getBlock(header.hash);
        testLog.getLog().info("Block: " + currentBlock.block.header.number);
        const extrinsics = currentBlock.block.extrinsics;
        //TODO: Find some extra determinist way to filter the extrinsic signed by the user
        extrinsicResult = extrinsics.filter(
          (ext) => ext.hash.toString() === txHash.toString(),
        );
        if (extrinsicResult.length > 0) {
          const index = extrinsics.findIndex((extrinsic) => {
            return extrinsic.hash.toString() === txHash.toString();
          });
          const events = await api.query.system.events();
          const eventsTriggeredByTx: MangataGenericEvent[] = events
            .filter((currentBlockEvent) => {
              return (
                currentBlockEvent.phase.isApplyExtrinsic &&
                currentBlockEvent.phase.asApplyExtrinsic.toNumber() === index
              );
            })
            .map((eventRecord) => {
              const { event, phase } = eventRecord;
              const types = event.typeDef;
              const eventData: MangataEventData[] = event.data.map(
                (d: any, i: any) => {
                  return {
                    lookupName: types[i].lookupName!,
                    data: d,
                  };
                },
              );
              return {
                event,
                phase,
                section: event.section,
                method: event.method,
                metaDocumentation: event.meta.docs.toString(),
                eventData,
                error: getTxError(api, event.method, eventData),
              } as MangataGenericEvent;
            });
          unsub();
          resolve(eventsTriggeredByTx);
        }
      },
    );
  });
}

export const getTxError = (
  api: ApiPromise,
  method: string,
  eventData: MangataEventData[],
): {
  documentation: string[];
  name: string;
} | null => {
  const failedEvent = method === "ExtrinsicFailed";

  if (failedEvent) {
    const error = eventData.find((item) =>
      item.lookupName.includes("DispatchError"),
    );
    const errorData = error?.data?.toHuman?.() as ErrorData | undefined;
    const errorIdx = errorData?.Module?.error;
    const moduleIdx = errorData?.Module?.index;

    if (errorIdx && moduleIdx) {
      try {
        const decode = api.registry.findMetaError({
          error: isHex(errorIdx) ? hexToU8a(errorIdx) : new BN(errorIdx),
          index: new BN(moduleIdx),
        });
        return {
          documentation: decode.docs,
          name: decode.name,
        };
      } catch (error) {
        return {
          documentation: ["Unknown error"],
          name: "UnknownError",
        };
      }
    } else {
      return {
        documentation: ["Unknown error"],
        name: "UnknownError",
      };
    }
  }

  return null;
};
