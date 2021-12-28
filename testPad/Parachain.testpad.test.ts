import {
  ApiPromise,
  Keyring,
  WsProvider,
} from "mangata-sdk/node_modules/@polkadot/api";
import BN from "bn.js";
import {getApi, initApi} from "../utils/api";
import {waitNewBlock} from "../utils/eventListeners";
import {User, AssetWallet} from "../utils/User";
import {getEnvironmentRequiredVars} from "../utils/utils";
import fs from "fs";
import {signTx} from "mangata-sdk";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());
const {sudo: sudoUserName} = getEnvironmentRequiredVars();

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let testUser1: User, sudo, keyring;

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

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  const user = "//Alice";

  test.each([user])("xyk-pallet: Reserve pair", async (bondAmount) => {
    const wsUrl = "ws://127.0.0.1:9944";
    const paraId = 2000;
    const pathToFiles = "/home/goncer/runner/mangata-node/";
    keyring = new Keyring({type: "sr25519"});
    sudo = new User(keyring, sudoUserName);
    testUser1 = new User(keyring, user);
    await fs.writeFileSync(
      testUser1.keyRingPair.address + ".json",
      JSON.stringify(testUser1.keyRingPair.toJson("mangata123"))
    );
    await fs.writeFileSync(
      sudo.keyRingPair.address + ".json",
      JSON.stringify(sudo.keyRingPair.toJson("mangata123"))
    );
    // add users to pair.
    keyring.addPair(testUser1.keyRingPair);
    keyring.addPair(sudo.keyRingPair);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);
    const wsProvider = new WsProvider(wsUrl);
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    //await signTx(api, api.tx.registrar.reserve(), testUser1.keyRingPair);
    const nextParaIdBefore = new BN(
      await (await api.query.registrar.nextFreeParaId()).toString()
    );
    try {
      await signTx(api, api.tx.registrar.reserve(), testUser1.keyRingPair);
    } catch (error) {}
    await waitNewBlock();
    const requestedNextParaIdAfter = new BN(
      await (await api.query.registrar.nextFreeParaId()).toString()
    );
    expect(nextParaIdBefore.lt(requestedNextParaIdAfter)).toBeTruthy();
    const genesis = fs
      .readFileSync(pathToFiles + "para-2000-genesis_mangata_dev_v4")
      .toString();
    const wasm = fs
      .readFileSync(pathToFiles + "para-2000-wasm_mangata_dev_v4")
      .toString();

    const scheduleParaInit = api.tx.parasSudoWrapper.sudoScheduleParaInitialize(
      new BN(paraId),
      {
        genesisHead: genesis,
        validationCode: wasm,
        parachain: true,
      }
    );
    await api.tx.sudo.sudo(scheduleParaInit).signAndSend(testUser1.keyRingPair);
    await waitNewBlock();
  });
});
