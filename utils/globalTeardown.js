/* eslint-disable no-undef */
/* eslint-disable no-console */
const { disconnect } = require("./api");

module.exports = async (globalConfig, projectConfig) => {
  if (process.env.SKIP_API_INIT || process.env.CHOPSTICK_ENABLED) return;
  console.error("GLOBAL TEARDOWN - DISCONNECT...");
  // eslint-disable-next-line no-undef
  await globalThis.server.stop();
  await globalThis.api.disconnect();
  await disconnect();
  console.error("...DISCONNECT DONE!");
};
