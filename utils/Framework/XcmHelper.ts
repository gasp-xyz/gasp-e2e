import {
  Blockchain,
  BuildBlockMode,
  setupWithServer,
} from "@acala-network/chopsticks";
import { StorageValues } from "@acala-network/chopsticks-core";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { HexString } from "@polkadot/util/types";
import { getPort } from "get-port-please";
import * as fs from "fs";
import { bufferToU8a, u8aToHex } from "@polkadot/util";
import { Assets } from "../Assets";
import { alice, setupApi, setupUsers, sudo } from "../setup";
import { Sudo } from "../sudo";
import { AssetId } from "../ChainSpecs";
import { BN_BILLION } from "@mangata-finance/sdk";

export type SetupOption = {
  endpoint: string;
  blockNumber?: number;
  blockHash?: HexString;
  wasmOverride?: string;
  db?: string;
  types?: Record<string, any>;
  localPort?: number;
  buildBlockMode?: BuildBlockMode;
  "allow-unresolved-imports"?: boolean;
};

export type DevApi = {
  newBlock: (param?: { count?: number; to?: number }) => Promise<string>;
  setStorage: (values: StorageValues, blockHash?: string) => Promise<void>;
  timeTravel: (date: string | number) => Promise<number>;
  setHead: (hashOrNumber: string | number) => Promise<void>;
};

export type ApiContext = {
  uri: string;
  chain: Blockchain;
  ws: WsProvider;
  api: ApiPromise;
  dev: DevApi;
  teardown: () => Promise<void>;
};

export const setupContext = async ({
  endpoint,
  blockNumber,
  blockHash,
  wasmOverride,
  db,
  types,
  localPort,
  buildBlockMode,
}: SetupOption): Promise<ApiContext> => {
  // random port
  const port = localPort ? localPort : await getPort();
  const config = {
    endpoint,
    port,
    block: blockNumber || blockHash,
    mockSignatureHost: true,
    "build-block-mode": buildBlockMode ? buildBlockMode : BuildBlockMode.Manual,
    db,
    "wasm-override": wasmOverride,
    "registered-types": { types: types },
    "runtime-log-level": 5,
    runtimeLogLevel: 5,
    "allow-unresolved-imports": true,
  };
  const { chain, listenPort, close } = await setupWithServer(config);
  const uri = `ws://localhost:${listenPort}`;
  const ws = new WsProvider(uri);
  const api = await ApiPromise.create({
    provider: ws,
    types: types,
  });

  await api.isReady;

  return {
    uri,
    chain,
    ws,
    api,
    dev: {
      newBlock: (param?: { count?: number; to?: number }): Promise<string> => {
        return ws.send("dev_newBlock", [param]);
      },
      setStorage: (values: StorageValues, blockHash?: string) => {
        return ws.send("dev_setStorage", [values, blockHash]);
      },
      timeTravel: (date: string | number) => {
        return ws.send<number>("dev_timeTravel", [date]);
      },
      setHead: (hashOrNumber: string | number) => {
        return ws.send("dev_setHead", [hashOrNumber]);
      },
    },
    async teardown() {
      await api.disconnect();
      await close();
    },
  };
};
export async function upgradeMangata(mangata: ApiContext) {
  if (process.env.WITH_MANGATA_UPGRADE !== "true") {
    return;
  }
  await setupApi();
  setupUsers();
  await mangata.dev.newBlock();
  await mangata.dev.setStorage({
    Tokens: {
      Accounts: [
        [
          [alice.keyRingPair.address, { token: 0 }],
          { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
        ],
        [
          [sudo.keyRingPair.address, { token: 0 }],
          { free: BN_BILLION.mul(AssetId.Mgx.unit).toString() },
        ],
      ],
    },
    Sudo: {
      Key: sudo.keyRingPair.address,
    },
  });
  await mangata.dev.newBlock();
  const path = `test/xcm/_releasesUT/0.32.0/kusama-v0.32.0.wasm`;
  const wasmContent = fs.readFileSync(path);
  const hexHash = mangata.api!.registry.hash(bufferToU8a(wasmContent)).toHex();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(sudo));
  await Sudo.asSudoFinalized(
    Sudo.sudo(
      //@ts-ignore
      mangata.api!.tx.parachainSystem.authorizeUpgrade(hexHash, false),
    ),
  );
  await mangata.dev.newBlock();
  const wasmParam = Uint8Array.from(wasmContent);
  const hex = u8aToHex(wasmParam);
  const param = hex.toString();
  await mangata.api.tx.sudo
    .sudo(mangata.api.tx.parachainSystem.enactAuthorizedUpgrade(param))
    .signAndSend(sudo.keyRingPair);

  await mangata.dev.newBlock();
  await mangata.dev.newBlock();
}
