import { ApiPromise } from "@polkadot/api";
import { testLog } from "./Logger.js";
import { getEnvironmentRequiredVars } from "./utils.js";
import { Mangata } from "@mangata-finance/sdk";

export let api: ApiPromise | null = null;
export let mangata: Mangata | null = null;

export const getApi = () => {
  if (!api) {
    throw new Error("Api not initialized");
  }
  return api;
};

export const initApi = async (uri = "") => {
  if (!uri) {
    const { chainUri: envUri } = getEnvironmentRequiredVars();
    uri = envUri;
  }

  testLog.getLog().info(`TEST_INFO: Running test in ${uri}`);
  mangata = Mangata.getInstance([uri]);
  api = await mangata.getApi();
  return api;
};

export async function getMangataInstance(uri = ""): Promise<Mangata> {
  if (!api) {
    await initApi(uri);
  }
  return mangata!;
}
export const disconnect = async (uri = "") => {
  if (mangata) {
    await mangata.disconnect();
  } else {
    await Mangata.getInstance([uri]).disconnect();
  }
};
