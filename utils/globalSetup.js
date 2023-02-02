/* eslint-disable no-console */
import { setupGasLess } from "./setup";

module.exports = async function (globalConfig, projectConfig) {
  const ipc = require("node-ipc").default;
  const api_module = require("./api");
  const utils = require("./utils");
  const polkadot_api = require("@polkadot/api");

  try {
    api_module.getApi();
  } catch (e) {
    await api_module.initApi();
  }

  const api = api_module.getApi();

  ipc.config.id = "nonceManager";
  ipc.config.retry = 1500;
  ipc.config.silent = false;
  ipc.config.sync = true;
  const { sudo } = utils.getEnvironmentRequiredVars();
  const keyring = new polkadot_api.Keyring({ type: "sr25519" });
  const sudoKeyringPair = keyring.createFromUri(sudo);
  const nonce = await api.rpc.system.accountNextIndex(sudoKeyringPair.address);
  console.info(`${nonce}`);

  ipc.serve(function () {
    ipc.server.on("getNonce", (data, socket) => {
      console.info("serving nonce" + data.id + nonce);
      ipc.server.emit(socket, "nonce-" + data.id, nonce.toNumber());
      nonce.iaddn(1);
    });
  });
  ipc.server.start();

  // eslint-disable-next-line no-undef
  globalThis.server = ipc.server;
  // eslint-disable-next-line no-undef
  globalThis.api = api;
  //Setup if  debugging a gasless test OR running gasless group
  if (
    (process.env.VSCODE_INSPECTOR_OPTIONS !== undefined &&
      process.env.VSCODE_INSPECTOR_OPTIONS.length > 0 &&
      globalConfig.testNamePattern
        .toString()
        .toLowerCase()
        .includes("gasless")) ||
    process.env.JEST_GROUP_gasless
  ) {
    console.info("GAS LESS test - Setting it up");
    process.env.FEES_ENABLED = false;
    await setupGasLess();
  }
};
