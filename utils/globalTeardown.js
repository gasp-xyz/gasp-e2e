/* eslint-disable no-undef */
/* eslint-disable no-console */
import { disconnect } from "./api";

const globalTearDown = async (globalConfig, projectConfig) => {
  if (process.env.CHOPSTICK_ENABLED || process.env.CHOPSTICK_UI) {
    return;
  }
  console.error("GLOBAL TEARDOWN - DISCONNECT...");
  // eslint-disable-next-line no-undef
  await globalThis.server.stop();
  await globalThis.api.disconnect();
  await disconnect();
  console.error("...DISCONNECT DONE!");
};

export default globalTearDown;
