import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import fs from "fs";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";
import { jest } from "@jest/globals";
const { sudo: sudoUserName, chainUri } = getEnvironmentRequiredVars();
jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

describe("Story tests > LP", () => {
  let sudo: User;
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
  });

  test("MGA can be runtime - upgraded", async () => {
    //lets create a pool with user1
    //TODO: Get nonce!
    const mangata = await getMangataInstance(chainUri);
    const api = await mangata.api();
    const hash =
      "0xa4f385913ba0acb618402fe01aa20a87ed3d5b58cc7d28cb7a9165eb309c9300";
    const wasmFile = fs.readFileSync("./test/upgrade/RC_upgrade_0.wasm");
    await signSendAndWaitToFinishTx(
      api.tx.sudo.sudo(
        //@ts-ignore
        api!.tx.parachainSystem.authorizeUpgrade(hash, false),
      ),
      sudo.keyRingPair,
    );
    await signSendAndWaitToFinishTx(
      api.tx.sudo.sudo(
        api!.tx.parachainSystem.enactAuthorizedUpgrade(wasmFile.toString()),
      ),
      sudo.keyRingPair,
    );
    await waitForUpgradeEvent();
  });
});
function waitForUpgradeEvent() {
  //throw new Error("Function not implemented.");
}
