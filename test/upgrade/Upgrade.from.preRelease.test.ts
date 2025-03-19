/*
 *
 * @group upgradeRuntime
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { bufferToU8a, BN } from "@polkadot/util";
import { api, getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import fs from "fs";
import { signTx } from "gasp-sdk";
import { testLog } from "../../utils/Logger";
import { downloadRelease } from "@terascope/fetch-github-release";
import { transferAsset } from "../../utils/tx";

import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

jest.setTimeout(300000);
process.env.NODE_ENV = "test";
let sudo, keyring;

//*******HOW TO USE******** */
//install JEST run it extension for vs code.
//export env. variables.
//run xyk-pallet: Create new users with bonded amounts.
// this ^^ will create json files with User_address as name.
// You can import those files into polkadotJS.
// If you want to use any action, write in the const address the user address to trigger the action.
// this will load the .json and perform the extrinsic action.
// have fun!
//*******END:HOW TO USE******** */

let wasmPath = process.env.WASM_PATH ? process.env.WASM_PATH : "";
const relayName = process.env.RELAY ? process.env.RELAY : "rococo";
const preRelease = process.env.PRE_RELEASE
  ? process.env.PRE_RELEASE === "true"
  : false;

describe("upgrade - testpad", () => {
  function filterRelease(release: { prerelease: boolean }) {
    // Filter out prereleases.
    return release.prerelease === preRelease;
  }
  function filterAsset(asset: { name: string | string[] }) {
    // Select assets that contain the string 'windows'.
    return asset.name.includes(relayName) && asset.name.includes(".wasm");
  }
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const user = "mangata-finance";
    const repo = "mangata-node";
    const outputdir = "./";
    const result = downloadRelease(
      user,
      repo,
      outputdir,
      filterRelease,
      filterAsset,
    )
      .then(function (path) {
        testLog.getLog().info("Downloaded!");
        return path;
      })
      .catch(function (err) {
        testLog.getLog().info(err.message);
      });
    const wasmspaths = (await Promise.all([result])) as unknown as string[];
    if (wasmspaths.length > 0) {
      if (!wasmPath) {
        wasmPath = wasmspaths[0][0];
      }
    }
    testLog.getLog().info("Downloaded in: " + wasmPath);
  });

  test("Upgrade runtime: authorizeUpgrade + enactUpgrade", async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    const wasm = wasmPath;
    keyring.addPair(sudo.keyRingPair);

    const wasmContent = fs.readFileSync(wasm, {
      flag: "r",
    });
    const hexHash = api!.registry.hash(bufferToU8a(wasmContent)).toHex();
    await signTx(
      api!,
      api!.tx.sudo.sudo(
        //@ts-ignore
        api!.tx.parachainSystem.authorizeUpgrade(hexHash, false),
      ),
      sudo.keyRingPair,
    );
    await signTx(
      api!,
      api!.tx.sudo.sudo(
        api!.tx.parachainSystem.enactAuthorizedUpgrade(wasmContent.toString()),
      ),
      sudo.keyRingPair,
    );
    let found = false;

    await api!.query.system.events((events) => {
      events.forEach((record) => {
        // extract the phase, event and the event types
        const { event, phase } = record;
        const types = event.typeDef;
        // show what we are busy with
        testLog
          .getLog()
          .info(
            event.section +
              ":" +
              event.method +
              "::" +
              "phase=" +
              phase.toString(),
          );
        testLog.getLog().info(event.meta.docs.toString());
        // loop through each of the parameters, displaying the type and data
        event.data.forEach(
          (data: { toString: () => string }, index: number) => {
            testLog.getLog().info(types[index].type + ";" + data.toString());
            if (
              event.section.toString().includes("parachainSystem") &&
              event.method.toString().includes("ValidationFunctionApplied")
            ) {
              found = true;
            }
          },
        );
      });
    });
    while (!found) {
      await waitForNBlocks(1);
    }
    const runtime = await api!.rpc.state.getRuntimeVersion();
    expect(runtime.authoringVersion.toNumber()).toBe(13);
    //lets wait if chain still produces blocks :)
    await waitForNBlocks(3);
    await transferAsset(
      sudo.keyRingPair,
      new BN(0),
      sudo.keyRingPair.address,
      new BN("1231244"),
    );
    await waitForNBlocks(5);
  });
  afterAll(async () => {
    await fs.rmSync(wasmPath);
  });
});
