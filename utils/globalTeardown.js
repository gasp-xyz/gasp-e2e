/* eslint-disable no-undef */
/* eslint-disable no-console */
import { disconnect } from "./api";
import { isRunningInChops } from "./utils";

const globalTearDown = async (globalConfig, projectConfig) => {
  if (isRunningInChops()) return;
  console.error("GLOBAL TEARDOWN - DISCONNECT...");
  // eslint-disable-next-line no-undef
  await globalThis.server.stop();
  await globalThis.api.disconnect();
  await disconnect();
  console.error("...DISCONNECT DONE!");
};

export default globalTearDown;
