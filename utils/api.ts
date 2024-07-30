import { ApiPromise } from "@polkadot/api";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars, getMangataApiUrlPort } from "./utils";
import { Mangata, MangataInstance } from "gasp-sdk";
import { getPort } from "get-port-please";
import XcmNetworks from "./Framework/XcmNetworks";
import { BuildBlockMode } from "@acala-network/chopsticks";
import { ApiContext } from "./Framework/XcmHelper";

export let api: ApiPromise | null = null;
export let mangata: MangataInstance | null = null;
export let mangataChopstick: ApiContext | null = null;
export let chopstickUri: String;
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
  if (process.env.CHOPSTICK_ENABLED) {
    const mgaPort = getMangataApiUrlPort();
    const chopstickPort = await getPort();
    mangataChopstick = await XcmNetworks.mangata({
      localPort: chopstickPort,
      buildBlockMode: BuildBlockMode.Instant,
    });
    uri = uri.replace(mgaPort.toString(), chopstickPort.toString());
    chopstickUri = uri;
  }
  testLog.getLog().info(`TEST_INFO: Running test in ${uri}`);
  mangata = Mangata.instance([uri]);
  api = await mangata.api();
  return api;
};

export async function getMangataInstance(uri = ""): Promise<MangataInstance> {
  if (!api) {
    await initApi(uri);
  }
  return mangata!;
}
export const disconnect = async () => {
  //TODO:sdkV2
  //  if (mangata) {
  //    await mangata.disconnect();
  //  } else {
  //    await Mangata.instance([uri]).disconnect();
  //  }
};
