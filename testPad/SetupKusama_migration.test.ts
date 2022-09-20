/* eslint-disable no-console */
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { Xyk } from "../utils/xyk";
import { getApi, initApi } from "../utils/api";
import { provisionBootstrap, scheduleBootstrap } from "../utils/tx";
import { MGA_ASSET_ID } from "../utils/Constants";
import { User } from "../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForBootstrapStatus,
  waitForNBlocks,
} from "../utils/utils";

import fs from "fs";
import { Sudo } from "../utils/sudo";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";
import { BN_THOUSAND } from "@mangata-finance/sdk";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let sudo;

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

describe("Boostrap - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  test("Step1: register-2000", async () => {
    const paraId = 2000;
    const keyring = new Keyring({ type: "sr25519" });
    const stakeAmount = new BN(Math.pow(10, 16).toString());
    const alice = keyring.addFromUri("//Alice");

    const wsProvider = new WsProvider("ws://127.0.0.1:9944");
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    const genesis = fs
      .readFileSync(
        "/home/goncer/projects/mangata-node/devops/parachain/config/genesis-state"
      )
      .toString();
    const wasm = fs
      .readFileSync(
        "/home/goncer/projects/mangata-node/devops/parachain/config/genesis-wasm"
      )
      .toString();
    const scheduleParaInit = api.tx.registrar.register(
      new BN(paraId),
      genesis,
      wasm
    );
    await scheduleParaInit.signAndSend(alice);
    const councilProposal2 = api.tx.council.propose(
      1,
      api.tx.slots.forceLease(paraId, alice.address, stakeAmount, 0, 999),
      64
    );
    await councilProposal2.signAndSend(alice);
  });
  test("Step2: Create bootstrap for pool 0-4->5", async () => {
    const keyring = new Keyring({ type: "sr25519" });
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    await setupApi();
    await setupUsers();
    const testUser1 = new User(keyring, "//Ferdie");
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(new BN(4), testUser1), // transferAll test
      Assets.mintNative(testUser1)
    );
    const blockstostart = 10;
    const bootstraplength = 20;
    await scheduleBootstrap(
      sudo,
      MGA_ASSET_ID,
      new BN(4),
      blockstostart,
      bootstraplength,
      1
    );
    await waitForBootstrapStatus("Public", 10);
    await provisionBootstrap(testUser1, new BN(4), new BN(100000000000));
    await provisionBootstrap(testUser1, MGA_ASSET_ID, new BN(100000));
    await waitForBootstrapStatus("Finished", bootstraplength);
    //pool created Id 5.
  });
  test("Step3: Register assets", async () => {
    const keyring = new Keyring({ type: "sr25519" });
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    await setupApi();
    await initApi();
    const api = await getApi();
    await setupUsers();
    api!.tx.sudo
      .sudo(
        api!.tx.assetRegistry.registerAsset({
          V1: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: 2000,
                },
                {
                  GeneralKey: 0x0080,
                },
              ],
            },
          },
        })
      )
      .signAndSend(sudo.keyRingPair);
    await waitForNBlocks(4);

    const location = {
      V1: {
        parents: 1,
        interior: {
          X1: {
            Parachain: 2114,
          },
        },
      },
    };
    api!.tx.sudo
      .sudo(api!.tx.assetRegistry.registerAsset(location))
      .signAndSend(sudo.keyRingPair);
    await waitForNBlocks(4);
  });
  test("Step4: Create pools and add asset Info", async () => {
    const keyring = new Keyring({ type: "sr25519" });
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    await setupApi();
    await initApi();
    const api = await getApi();
    const [user1] = await setupUsers();

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(new BN(7), user1),
      Assets.mintToken(new BN(4), user1),
      Assets.mintNative(user1),
      Sudo.sudoAs(
        user1,
        Xyk.createPool(MGA_ASSET_ID, BN_THOUSAND, new BN(7), BN_THOUSAND)
      ),
      Sudo.sudoAs(
        user1,
        Xyk.createPool(new BN(4), BN_THOUSAND, new BN(7), BN_THOUSAND)
      )
    );
    await Sudo.batchAsSudoFinalized(
      api.tx.sudo.sudo(
        api.tx.assetsInfo.setInfo(
          7,
          api.createType("Vec<u8>", "TUR"),
          api.createType("Vec<u8>", "TUR"),
          api.createType("Vec<u8>", "Turing native token on Mangata"),
          api.createType("u32", "10")
        )
      ),
      api.tx.sudo.sudo(
        api.tx.assetsInfo.setInfo(
          4,
          api.createType("Vec<u8>", "KSM"),
          api.createType("Vec<u8>", "KSM"),
          api.createType("Vec<u8>", "Kusama Native Token on Mangata"),
          api.createType("u32", "12")
        )
      )
    );
  });
});
