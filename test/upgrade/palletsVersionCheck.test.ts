/*
 *
 * @group upgrade
 */

import { getApi, initApi } from "../../utils/api";
import { jest } from "@jest/globals";
import { setupApi, setupUsers } from "../../utils/setup";
import jsonpath from "jsonpath";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Mangata } from "@mangata-finance/sdk";
import "jest-extended";
import { testLog } from "../../utils/Logger";
import { xxhashAsHex } from "@polkadot/util-crypto";
import { stripHexPrefix } from "../../utils/setupsOnTheGo";
jest.setTimeout(1500000);

describe("Story tests > LP", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    setupUsers();
  });

  beforeEach(async () => {});

  test("Validate Current node with Kusama and spot runtime differences", async () => {
    const localApi = await Mangata.instance([
      getEnvironmentRequiredVars().chainUri,
    ]).api();
    const ksmApi = await Mangata.instance([
      "wss://kusama-archive.mangata.online",
    ]).api();
    const pallets = Object.entries(localApi.query);
    // const meta5k = await ksmApi.query.assetRegistry.metadata("5");
    // const meta5l = await localApi.query.assetRegistry.metadata("5");
    const errors: any = [];
    const info = [];
    const storageVersion = ":__STORAGE_VERSION__:";
    for (let i = 0; i < pallets.length; i++) {
      const palletName = pallets[i][0];
      const palletElement = palletName[0].toUpperCase() + palletName.slice(1);
      const storageKey =
        xxhashAsHex(palletElement, 128) +
        stripHexPrefix(xxhashAsHex(storageVersion, 128));
      testLog.getLog().info(`Validating pallet ${storageKey}`);
      testLog.getLog().info(`Validating pallet ${palletElement}`);
      const ksmStorage = await ksmApi.rpc.state.getStorage(storageKey);
      const localStorage = await localApi.rpc.state.getStorage(storageKey);
      testLog.getLog().info(`Kusama Version: ${ksmStorage}`);
      testLog.getLog().info(`Local Version: ${localStorage}`);
      info.push([ksmStorage, localStorage, palletName, storageKey]);
    }
    info.forEach((element: any) => {
      if (element[0].toString() !== element[1].toString()) {
        errors.push(element);
      }
    });
    testLog
      .getLog()
      .info("[Kusama Version, Local Version, Pallet , StorageKey]");
    info.forEach((element: any) => {
      testLog.getLog().info(JSON.stringify(element));
    });
    expect(errors).toBeEmpty();
  });
});
//Not needed for now but useful for future.
export async function listStorages(ws = "wss://kusama-archive.mangata.online") {
  await initApi(ws);
  const api = await getApi();
  const meta = await api.rpc.state.getMetadata();
  const metaJson = JSON.parse(JSON.stringify(meta));
  const res = jsonpath.query(metaJson, "$..pallets[*].name");
  const result: any = [];
  res.forEach((pallet) => {
    const storageItems = jsonpath.query(
      metaJson,
      `$..pallets[?(@.name =="${pallet}")].storage.items[*].name`,
    );
    result.push([pallet, storageItems]);
  });
  return result;
}
