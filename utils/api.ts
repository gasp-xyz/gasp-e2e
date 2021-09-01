import { ApiPromise } from "@polkadot/api";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars } from "./utils";
import { Mangata } from "mangata-sdk";

export let api: ApiPromise | null = null;

const { chainUri: envUri } = getEnvironmentRequiredVars();
export const getApi = () => {
  if (!api) {
    throw new Error("Api not initialized");
  }
  return api;
};

export const initApi = async (uri = "") => {
  if (!uri) {
    uri = envUri;
  }

  testLog.getLog().info(`TEST_INFO: Running test in ${uri}`);
  const mangata = Mangata.getInstance(uri);
  api = await mangata.getApi();
  return api;
};
