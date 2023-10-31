import { ApiPromise, Keyring } from "@polkadot/api";
import { testLog } from "./Logger";
import {
  getEnvironmentRequiredVars,
  getMangataApiUrlPort,
  isRunningInChops,
} from "./utils";
import { BN_MILLION, Mangata, MangataInstance } from "@mangata-finance/sdk";
import XcmNetworks from "./Framework/XcmNetworks";
import { BuildBlockMode } from "@acala-network/chopsticks";
import { ApiContext } from "./Framework/XcmHelper";
import { SudoDB } from "./SudoDB";
import { AssetId } from "./ChainSpecs";
import { User } from "./User";
import { waitNewBlock } from "./eventListeners";
import { setupApi } from "./setup";

export let nodeUri: string;
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

export function getSudoAddress() {
  return new User(
    new Keyring({ type: "sr25519" }),
    getEnvironmentRequiredVars().sudo,
  ).keyRingPair.address;
}

export const initApi = async (uri = "") => {
  if (!uri) {
    const { chainUri: envUri } = getEnvironmentRequiredVars();
    uri = envUri;
  }
  if (isRunningInChops()) {
    const mgaPort = getMangataApiUrlPort();
    const chopstickPort = await SudoDB.getInstance().getPortFromIPC();
    mangataChopstick = await XcmNetworks.mangata({
      localPort: chopstickPort,
      buildBlockMode: BuildBlockMode.Instant,
    });
    uri = uri.replace(mgaPort.toString(), chopstickPort.toString());
    chopstickUri = uri;
    //add tokens to alice - sudo.

    await mangataChopstick.dev.setStorage({
      Tokens: {
        Accounts: [
          [
            [getSudoAddress(), { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_MILLION).toString() },
          ],
        ],
      },
      Sudo: {
        Key: getSudoAddress(),
      },
    });
  }
  testLog.getLog().info(`TEST_INFO: Running test in ${uri}`);
  mangata = Mangata.instance([uri]);
  api = await mangata.api();
  await setupApi(api);
  await waitNewBlock();
  nodeUri = uri;
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
