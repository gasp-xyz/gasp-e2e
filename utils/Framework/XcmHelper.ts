import {
  Blockchain,
  BuildBlockMode,
  setupWithServer,
} from "@acala-network/chopsticks";
import { StorageValues } from "@acala-network/chopsticks/lib/utils/set-storage";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { HexString } from "@polkadot/util/types";
import getPort from "get-port-please";

export type SetupOption = {
  endpoint: string;
  blockNumber?: number;
  blockHash?: HexString;
  wasmOverride?: string;
  db?: string;
  types?: Record<string, any>;
  localPort?: number;
  buildBlockMode?: BuildBlockMode;
};

export type DevApi = {
  newBlock: (param?: { count?: number; to?: number }) => Promise<string>;
  setStorage: (values: StorageValues, blockHash?: string) => Promise<void>;
  timeTravel: (date: string | number) => Promise<number>;
  setHead: (hashOrNumber: string | number) => Promise<void>;
};

export type ApiContext = {
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
  const port = localPort ? localPort : await getPort.getPort();
  const config = {
    endpoint,
    port,
    block: blockNumber || blockHash,
    mockSignatureHost: true,
    "build-block-mode": buildBlockMode ? buildBlockMode : BuildBlockMode.Manual,
    db,
    "wasm-override": wasmOverride,
    "registered-types": { types: types },
  };
  const { chain, listenPort, close } = await setupWithServer(config);

  const ws = new WsProvider(`ws://localhost:${listenPort}`);
  const api = await ApiPromise.create({
    provider: ws,
    types: types,
  });

  await api.isReady;

  return {
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
