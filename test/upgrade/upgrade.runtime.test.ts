/*
 *
 * @group upgradeRuntime
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import fs from "fs";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";

const { sudo: sudoUserName, chainUri } = getEnvironmentRequiredVars();
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

describe("Story tests > LP", () => {
  let sudo: User;
  let testUser1: User;

  let keyring: Keyring;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  beforeEach(async () => {
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);
    testUser1 = new User(keyring);
  });

  test("MGA can be runtime - upgraded", async () => {
    //lets create a pool with user1
    const mangata = await getMangataInstance(chainUri);
    const api = await mangata.getApi();
    const hash =
      "0xa4f385913ba0acb618402fe01aa20a87ed3d5b58cc7d28cb7a9165eb309c9300";
    const wasmFile = fs.readFileSync("./RC_upgrade_0.wasm");
    await testUser1.addMGATokens(sudo);
    await signSendAndWaitToFinishTx(
      api.tx.sudo.sudo(api!.tx.parachainSystem.authorizeUpgrade(hash)),
      sudo.keyRingPair
    );
    await signSendAndWaitToFinishTx(
      api.tx.sudo.sudo(
        api!.tx.parachainSystem.enactAuthorizedUpgrade(wasmFile)
      ),
      sudo.keyRingPair
    );
    await waitForUpgradeEvent();
  });
});
function waitForUpgradeEvent() {
  //throw new Error("Function not implemented.");
}
