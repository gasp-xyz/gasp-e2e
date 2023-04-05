import { ApiPromise } from "@polkadot/api";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars, getMangataApiUrlPort } from "./utils";
import { Mangata } from "@mangata-finance/sdk";
import getPort from "get-port-please";
import XcmNetworks from "./Framework/XcmNetworks";
import { BuildBlockMode } from "@acala-network/chopsticks";
import { ApiContext } from "./Framework/XcmHelper";

export let api: ApiPromise | null = null;
export let mangata: Mangata | null = null;
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
  if (process.env.CHOPSTICK_ENABLED === "true") {
    const mgaPort = getMangataApiUrlPort();
    const chopstickPort = await getPort.getPort();
    mangataChopstick = await XcmNetworks.mangata({
      localPort: chopstickPort,
      buildBlockMode: BuildBlockMode.Instant,
    });
    uri = uri.replace(mgaPort.toString(), chopstickPort.toString());
    chopstickUri = uri;
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
