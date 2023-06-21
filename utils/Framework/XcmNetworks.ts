import dotenv from "dotenv";
import { setupContext, SetupOption } from "./XcmHelper";

dotenv.config();

const endpoints = {
  kusama: "wss://kusama-rpc.polkadot.io",
  statemine: "wss://statemine.api.onfinality.io/public-ws",
  imbue: "wss://imbue-kusama.imbue.network",
  karura: "wss://karura-rpc-0.aca-api.network",
  mangata: "wss://kusama-archive.mangata.online",
  bifrost: "wss://bifrost-rpc.dwellir.com",
  turing: "wss://rpc.turing.oak.tech",
};

const toNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return Number(value);
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  kusama: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.KUSAMA_WASM,
      blockNumber: toNumber(process.env.KUSAMA_BLOCK_NUMBER),
      endpoint: process.env.KUSAMA_ENDPOINT ?? endpoints.kusama,
      db: process.env.DB_PATH,
      ...options,
    }),
  imbue: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.IMBUE_WASM,
      blockNumber: toNumber(process.env.IMBUE_BLOCK_NUMBER),
      endpoint: process.env.IMBUE_ENDPOINT ?? endpoints.imbue,
      db: process.env.DB_PATH,
      ...options,
    }),
  turing: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.TURING_WASM,
      blockNumber: toNumber(process.env.TURING_BLOCK_NUMBER),
      endpoint: process.env.TURING_ENDPOINT ?? endpoints.turing,
      db: process.env.DB_PATH,
      ...options,
    }),
  statemine: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.STATEMINE_WASM,
      blockNumber: toNumber(process.env.STATEMINE_BLOCK_NUMBER),
      endpoint: process.env.STATEMINE_ENDPOINT ?? endpoints.statemine,
      db: process.env.DB_PATH,
      ...options,
    }),
  karura: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.KARURA_WASM,
      blockNumber: toNumber(process.env.KARURA_BLOCK_NUMBER),
      endpoint: process.env.KARURA_ENDPOINT ?? endpoints.karura,
      db: process.env.DB_PATH,
      ...options,
    }),
  biforst: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.BIFROST_WASM,
      blockNumber: toNumber(process.env.BIFROST_BLOCK_NUMBER),
      endpoint: process.env.BIFROST_ENDPOINT ?? endpoints.bifrost,
      db: process.env.DB_PATH,
      ...options,
    }),
  mangata: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.MANGATA_WASM,
      blockNumber: toNumber(process.env.MANGATA_BLOCK_NUMBER),
      endpoint: process.env.MANGATA_ENDPOINT ?? endpoints.mangata,
      db: process.env.DB_PATH,
      types: {
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
      ...options,
    }),
};
