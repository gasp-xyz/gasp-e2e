/* eslint-disable no-console */
import { isBackendTest, setupApi, setupGasLess, setupUsers } from "./setup";
import dotenv from "dotenv";
import ipc from "node-ipc";
import { getApi, initApi } from "./api";
import { getEnvironmentRequiredVars } from "./utils";
import { Keyring } from "@polkadot/api";
import { testLog } from "./Logger.js";
import { Sudo } from "./sudo.js";
import { Assets } from "./Assets.js";

dotenv.config();

const globalConfig = async () => {
  if (process.env.CHOPSTICK_ENABLED || process.env.CHOPSTICK_UI) {
    return;
  }

  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  console.warn(`getApi`);
  const api = getApi();

  ipc.config.id = "nonceManager";
  ipc.config.retry = 1500;
  ipc.config.silent = false;
  ipc.config.sync = true;
  const sudoPrivateKey = getEnvironmentRequiredVars().ethSudoAddress;
  const keyring = new Keyring({ type: "ethereum" });
  const sudoKeyringPair = keyring.createFromUri(sudoPrivateKey);
  const nonce = await api.rpc.system.accountNextIndex(sudoKeyringPair.address);
  let numCollators = (await api?.query.parachainStaking.candidatePool()).length;
  let assetIds = [];
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
    ipc.server.on("getTokenId", (data, socket) => {
      const assetId = assetIds.pop();
      if (assetIds.length === 0) {
        registerAssets().then((value) => (assetIds = value.reverse()));
      }
      console.info("serving getTokenId" + data.id + assetId);
      ipc.server.emit(socket, "TokenId-" + data.id, assetId);
    });
  });
  ipc.server.start();
  // eslint-disable-next-line no-undef
  globalThis.server = ipc.server;
  // eslint-disable-next-line no-undef
  globalThis.api = api;
  //enable gasless! :brum brum:
  await setupGasLess();

  if (isBackendTest()) {
    testLog.getLog().info("Registering assets....");
    const registeredIds = await registerAssets();
    assetIds = registeredIds.reverse();
  } else {
    testLog.getLog().info("Not a BE test, skipping asset registration!");
  }
};

export default globalConfig;

async function registerAssets(num = 300) {
  await setupApi();
  setupUsers();
  const txs = [
    ...Array(num)
      .fill(0)
      .map((_, i) => {
        return Assets.registerAsset(`TEST_${i}`, `SYM_${i}`, 18);
      }),
  ];
  const result = await Sudo.batchAsSudoFinalized(...txs);
  testLog.getLog().info("Registered assets", result);
  return result
    .filter((X) => X.method === "RegisteredAsset")
    .map((t) => t.eventData[0].data.toString());
}
