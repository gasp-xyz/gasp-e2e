import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { getApi, initApi } from "../utils/api";
import { testLog } from "../utils/Logger";
import { signSendAndWaitToFinishTx } from "../utils/txHandler";
import { User } from "../utils/User";
import { getEnvironmentRequiredVars } from "../utils/utils";
import { Mangata } from "@mangata-finance/sdk";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { mnemonicToMiniSecret } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import "dotenv/config";
import { jest } from "@jest/globals";

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
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.api();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);
    await signSendAndWaitToFinishTx(
      api?.tx.system.remark("0x00"),
      user.keyRingPair
    ).then();
  });
  test("V4 xtokens transfer from 2110 to 2001", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.api();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    const user2 = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.xTokens.transfer(
        new BN(4),
        new BN("67000000000000"),
        {
          V3: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: 2001,
                },
                {
                  AccountId32: {
                    network: undefined,
                    id: user2.keyRingPair.publicKey,
                  },
                },
              ],
            },
          },
        },
        {
          Unlimited: true,
        }
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });

  test("MVR- V4 xtokens transferToRely:2110->rely", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance([getEnvironmentRequiredVars().chainUri]);
    const api = await mga.api();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.xTokens.transfer(
        4,
        5573135891141,
        {
          V3: {
            parents: 1,
            interior: {
              X1: {
                AccountId32: {
                  network: undefined,
                  id: user.keyRingPair.publicKey,
                },
              },
            },
          },
        },
        {
          Unlimited: undefined,
        }
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });

  test("MVR- V4 xtokens relyToMGA", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const wsProvider = new WsProvider(getEnvironmentRequiredVars().relyUri);
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    const user2 = new User(keyring, "//Alice");
    testLog
      .getLog()
      .info("sending tokens to user: " + user2.keyRingPair.address);
    keyring.addPair(user.keyRingPair);
    keyring.addPair(user2.keyRingPair);
    //@ts-ignore
    await api?.tx.xcmPallet
      .limitedReserveTransferAssets(
        {
          V3: {
            parents: 0,
            interior: {
              X1: {
                Parachain: 2110,
              },
            },
          },
        },
        {
          V3: {
            parents: 0,
            interior: {
              X1: {
                AccountId32: {
                  network: undefined,
                  id: user2.keyRingPair.publicKey,
                },
              },
            },
          },
        },
        {
          V3: [
            {
              id: {
                Concrete: {
                  parents: 0,
                  interior: "Here",
                },
              },
              fun: {
                Fungible: 100000000000000,
              },
            },
          ],
        },
        { feeAssetItem: 0 },
        {
          Unlimited: undefined,
        }
      )
      .signAndSend(user.keyRingPair);

    testLog.getLog().warn("done");
  });

  test("V4 xtokens transfer from 2001 TO 2110", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const mga = Mangata.instance(["ws://127.0.0.1:9949"]);
    const api = await mga.api();
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    const user2 = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.xTokens.transfer(
        new BN(4),
        new BN("67000000000000"),
        {
          V3: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: 2110,
                },
                {
                  AccountId32: {
                    network: undefined,
                    id: user2.keyRingPair.publicKey,
                  },
                },
              ],
            },
          },
        },
        {
          Unlimited: true,
        }
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });
  test("MVR- V4 xtokens transferToRely - 2001: fails on polkadotXcm.reserveTransferAssets:polkadotXcm.Filtered", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const wsProvider = new WsProvider("ws://127.0.0.1:9949");
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    keyring.addPair(user.keyRingPair);

    await signSendAndWaitToFinishTx(
      api?.tx.xTokens.transfer(
        4,
        5573135891141,
        {
          V3: {
            parents: 1,
            interior: {
              X1: {
                AccountId32: {
                  network: undefined,
                  id: user.keyRingPair.publicKey,
                },
              },
            },
          },
        },
        {
          Unlimited: undefined,
        }
      ),
      user.keyRingPair
    ).then();
    testLog.getLog().warn("done");
  });

  test("MVR- V4 xtokens relyTo 2001:OK-Id:4:noFees?10,000,000,000,000,000", async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    const wsProvider = new WsProvider(getEnvironmentRequiredVars().relyUri);
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    keyring = new Keyring({ type: "sr25519" });
    const user = new User(keyring, "//Alice");
    const user2 = new User(keyring, "//Alice");
    testLog
      .getLog()
      .info("sending tokens to user: " + user2.keyRingPair.address);
    keyring.addPair(user.keyRingPair);
    keyring.addPair(user2.keyRingPair);
    //@ts-ignore
    await api?.tx.xcmPallet
      .limitedReserveTransferAssets(
        {
          V3: {
            parents: 0,
            interior: {
              X1: {
                Parachain: 2001,
              },
            },
          },
        },
        {
          V3: {
            parents: 0,
            interior: {
              X1: {
                AccountId32: {
                  network: undefined,
                  id: user2.keyRingPair.publicKey,
                },
              },
            },
          },
        },
        {
          V3: [
            {
              id: {
                Concrete: {
                  parents: 0,
                  interior: "Here",
                },
              },
              fun: {
                Fungible: new BN("10000000000000000"),
              },
            },
          ],
        },
        { feeAssetItem: 0 },
        {
          Unlimited: undefined,
        }
      )
      .signAndSend(user.keyRingPair);

    testLog.getLog().warn("done");
  });
});
