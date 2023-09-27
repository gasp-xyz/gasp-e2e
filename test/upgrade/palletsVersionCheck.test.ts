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
    for (let i = 0; i < pallets.length; i++) {
      const palletElement = pallets[i][0];
      testLog.getLog().info(`Validating pallet ${palletElement}`);
      if (
        !Object.entries(ksmApi.query[palletElement]).find(
          (x) => x[0] === "palletVersion"
        )
      ) {
        testLog
          .getLog()
          .info(
            `Skipping :: ${palletElement} : Does not implement palletVersion`
          );
        continue;
      }
      const ksmVersion = (
        await ksmApi.query[palletElement].palletVersion()
      ).toHuman();
      const localVersion = (
        await localApi.query[palletElement].palletVersion()
      ).toHuman();
      if (localVersion !== ksmVersion) {
        errors.push([palletElement, ksmVersion, localVersion]);
      }
    }
    testLog.getLog().info("[Pallet, Kusama Version, Local Version]");
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
      `$..pallets[?(@.name =="${pallet}")].storage.items[*].name`
    );
    result.push([pallet, storageItems]);
  });
  return result;
}
