import dotenv from 'dotenv'

import { SetupOption, setupContext } from './XcmHelper'

dotenv.config()

const endpoints = {
    kusama: 'wss://kusama-rpc.polkadot.io',
    statemine: 'wss://statemine-rpc.polkadot.io',
    karura: 'wss://karura-rpc-0.aca-api.network',
    mangata: 'wss://mangata-x.api.onfinality.io/public-ws',
    bifrost: 'wss://bifrost-rpc.dwellir.com',
}

const toNumber = (value: string | undefined): number | undefined => {
    if (value === undefined) {
        return undefined
    }

    return Number(value)
}

export default {
    kusama: (options?: Partial<SetupOption>) =>
        setupContext({
            wasmOverride: process.env.KUSAMA_WASM,
            blockNumber: toNumber(process.env.KUSAMA_BLOCK_NUMBER),
            endpoint: process.env.KUSAMA_ENDPOINT ?? endpoints.kusama,
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
            endpoint: process.env.BIFROST_ENDPOINT ?? endpoints.bifrostkarura,
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
                    seed: 'H256',
                    proof: 'H512',
                },
                Header: {
                    parentHash: 'Hash',
                    number: 'Compact<BlockNumber>',
                    stateRoot: 'Hash',
                    extrinsicsRoot: 'Hash',
                    digest: 'Digest',
                    seed: 'ShufflingSeed',
                    count: 'BlockNumber',
                }
            },
            ...options,
        }),
}
