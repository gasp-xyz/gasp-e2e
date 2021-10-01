/*
 *
 * @group xyk
 * @group ci
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { testLog } from "../../utils/Logger";
import { Header } from "@polkadot/types/interfaces/runtime";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const DEFAULT_TIME_OUT_MS = 42000;

describe("test CI", () => {
  let api: any;
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  test("xyk-CI - Node is up and running", async () => {
    api = await getApi();
    const health = await (api.rpc as any).system.health();
    testLog.getLog().info("Node health : " + health.toString());
    expect(health.toString()).not.toBeUndefined();

    const version = await (api.rpc as any).system.version();
    testLog.getLog().info("Node version : " + version.toString());
    expect(version.toString()).not.toBeUndefined();

    const heads = await waitNewHeaders(2);
    const [headNo1, headNo0] = [
      JSON.parse(heads[1].toString()).number,
      JSON.parse(heads[0].toString()).number,
    ];
    testLog.getLog().info(`Node numbers : #${headNo0} , #${headNo1}`);
    expect(headNo1).toBeGreaterThan(headNo0);
  });

  async function waitNewHeaders(numHeads = 5): Promise<Header[]> {
    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject();
      }, DEFAULT_TIME_OUT_MS);

      const api = getApi();
      let count = 0;
      const blocks: Header[] = [];
      // Subscribe to the new headers
      const unsubHeads = await api.rpc.chain.subscribeNewHeads((lastHeader) => {
        blocks.push(lastHeader);
        if (++count === numHeads) {
          unsubHeads();
          resolve(blocks);
        }
      });
    });
  }

  afterEach(async () => {
    const mangata = await getMangataInstance();
    await mangata.disconnect();
  });
});
