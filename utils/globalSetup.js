/* eslint-disable no-console */
import { setupGasLess } from "./setup";
import dotenv from "dotenv";
import ipc from "node-ipc";
import { getApi, initApi } from "./api";
import { getEnvironmentRequiredVars, isRunningInChops } from "./utils";
import { Keyring } from "@polkadot/api";
import { getPort } from "get-port-please";

dotenv.config();

const globalConfig = async (globalConfig, projectConfig) => {
  ipc.config.id = "nonceManager";
  ipc.config.retry = 1500;
  ipc.config.silent = false;
  ipc.config.sync = true;

  if (isRunningInChops()) {
    ipc.serve(function () {
      ipc.server.on("getPort", async (data, socket) => {
        const port = await getPort();
        console.info("serving getPort" + data.id + port);
        ipc.server.emit(socket, "port-" + data.id, port);
      });
    });
    ipc.server.start();

    // eslint-disable-next-line no-undef
    globalThis.server = ipc.server;

    return;
  }

  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  const api = getApi();

  const { sudo } = getEnvironmentRequiredVars();
  const keyring = new Keyring({ type: "sr25519" });
  const sudoKeyringPair = keyring.createFromUri(sudo);
  const nonce = await api.rpc.system.accountNextIndex(sudoKeyringPair.address);
  let numCollators = (await api?.query.parachainStaking.candidatePool()).length;
  console.info(`${nonce}`);
  console.info(`${numCollators}`);

  ipc.serve(function () {
    ipc.server.on("getNonce", (data, socket) => {
      console.info("serving nonce" + data.id + nonce);
      ipc.server.emit(socket, "nonce-" + data.id, nonce.toNumber());
      nonce.iaddn(1);
    });
    ipc.server.on("getCandidate", (data, socket) => {
      console.info("serving getCandidate" + data.id + numCollators);
      ipc.server.emit(socket, "candidate-" + data.id, numCollators);
      numCollators = numCollators + 1;
    });
  });
  ipc.server.start();

  // eslint-disable-next-line no-undef
  globalThis.server = ipc.server;
  // eslint-disable-next-line no-undef
  globalThis.api = api;
  //enable gasless! :brum brum:
  await setupGasLess();
};

export default globalConfig;
