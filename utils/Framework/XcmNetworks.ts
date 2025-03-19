import dotenv from "dotenv";
import { setupContext, SetupOption } from "./XcmHelper";

dotenv.config();

const endpoints = {
  kusama: "wss://kusama-rpc.polkadot.io",
  statemine: "wss://ksm-rpc.stakeworld.io/assethub",
  imbue: "wss://kusama.imbuenetwork.com",
  karura: "wss://karura-rpc-0.aca-api.network",
  mangata: "wss://kusama-archive.mangata.online",
  bifrost: "wss://bifrost-rpc.liebi.com/ws",
  turing: "wss://rpc.turing.oak.tech",
  moonriver: "wss://moonriver-rpc.dwellir.com",
};

const toNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return Number(value);
};

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
  moonriver: (options?: Partial<SetupOption>) =>
    setupContext({
      wasmOverride: process.env.MOONRIVER_WASM,
      blockNumber: toNumber(process.env.MOONRIVER_BLOCK_NUMBER),
      endpoint: process.env.MOONRIVER_ENDPOINT ?? endpoints.moonriver,
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
