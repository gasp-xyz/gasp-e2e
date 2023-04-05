import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { testLog } from "../utils/Logger";
import { signSendAndWaitToFinishTx } from "../utils/txHandler";
import { User } from "../utils/User";
import { getEnvironmentRequiredVars, sleep } from "../utils/utils";
import { Mangata } from "@mangata-finance/sdk";
import { mnemonicToMiniSecret } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";
import { Sudo } from "../utils/sudo";
import { signSendSuccess } from "../utils/sign";
import { ChainId, AssetId } from "../utils/ChainSpecs";
import { OakNode } from "../utils/Framework/Node/OakNode";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let keyring;

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
  const mnemonicMini = mnemonicToMiniSecret(
    "remain flame shell morning solar filter silver lawn clarify witness sign wall"
  );
  // eslint-disable-next-line no-console
  testLog.getLog().warn(u8aToHex(mnemonicMini));
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  test("V4 - remarks", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.getInstance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);
    await signSendAndWaitToFinishTx(
      api?.tx.system.remark("0x00"),
      user.keyRingPair
    ).then();
  });
  test("V4 xtokens transfer", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.getInstance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    const user2 = new User(keyring, "//Charlie");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.xTokens.transfer(
        new BN(4),
        new BN("200000000000"),
        {
          V1: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: 2001,
                },
                {
                  AccountId32: {
                    network: "Any",
                    id: user2.keyRingPair.publicKey,
                  },
                },
              ],
            },
          },
        },
        new BN("6000000000")
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });

  test("V4 xtokens transferToRely", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.getInstance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.getApi();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.polkadotXcm.reserveTransferAssets(
        {
          V1: {
            parents: 1,
            interior: "Here",
          },
        },
        {
          V1: {
            parents: 1,
            interior: {
              X1: {
                AccountId32: {
                  network: "Any",
                  id: "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
                },
              },
            },
          },
        },
        {
          V1: [
            {
              id: {
                Concrete: {
                  parents: 1,
                  interior: "Here",
                },
              },
              fun: {
                Fungible: new BN("100000000000"),
              },
            },
          ],
        },
        new BN("0")
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });

  test("V4 xtokens relyToMGA", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    const user2 = new User(keyring);
    testLog
      .getLog()
      .info("sending tokens to user: " + user2.keyRingPair.address);
    keyring.addPair(user.keyRingPair);
    keyring.addPair(user2.keyRingPair);
  });
  test.skip("Test XCM fail when no location or no fee", async () => {
    await setupApi();
    await setupUsers();
    await Sudo.asSudoFinalized(
      Assets.updateAsset(7, {
        metadata: {
          xcm: { feePerSecond: 0 },
          xyk: { operationsDisabled: false },
        },
      })
    );

    const mga = await Mangata.getInstance(["ws://localhost:9946"]);
    keyring = new Keyring({ type: "sr25519" });
    const testUser1 = new User(keyring, "//Alice");
    keyring.addPair(testUser1.keyRingPair);
    const oakApi = await OakNode.create("ws://localhost:9949");
    await signSendSuccess(
      oakApi.api,
      oakApi.api.tx.utility.batchAll([
        oakApi.xTokenTransfer(
          ChainId.Mg,
          AssetId.Tur,
          AssetId.Tur.unit.mul(new BN(10_000)),
          testUser1
        ),
      ]),
      testUser1
    );
    testLog.getLog().warn("done");

    //    keyring.pairs[0].decodePkcs8("mangata123");
    await mga.sendTokenFromParachainToMangata(
      "ws://localhost:9949",
      "TUR",
      "800000000",
      testUser1.keyRingPair,
      testUser1.keyRingPair.address,
      new BN("176652431432582")
    );
    await mga.sendTokenFromMangataToParachain(
      "TUR",
      "8000000000000",
      2114,
      testUser1.keyRingPair,
      testUser1.keyRingPair.address,
      new BN("17665243143258")
    );
    await sleep(5000);
  });
});
