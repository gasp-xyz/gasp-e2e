import { User } from "../../utils/User";
import { Utils } from "./Utils";
import { Keyring } from "@polkadot/api";
import { Node } from "../../utils/cluster/Node";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import fs from "fs";

const TUR_WEIGHT = 4 * 200_000_000;
const MG_WEIGHT = 4 * 1_000_000_000;
let mga: Node;
let testUser: any;
let alice: User;
let imbue: AcalaNode;

beforeAll(async () => {
  //await initApi();
  const imbueUri = "wss://rococo.imbue.network";
  imbue = new AcalaNode(imbueUri);
  mga = new Node(
    "mga",
    "wss://roccoco-testnet-collator-01.mangatafinance.cloud"
  );
  await imbue.connect();
  await mga.connect();

  const keyring = new Keyring({ type: "sr25519" });
  const address =
    "/home/goncer/accounts/5FA3LcCrKMgr9WHqyvtDhDarAXRkJjoYrSy6XnZPKfwiB3sY";
  const file = await fs.readFileSync(address + ".json");
  testUser = new User(keyring, "asd", JSON.parse(file as any));
  keyring.addPair(testUser.keyRingPair);
  keyring.pairs[0].decodePkcs8("mangata123");
});

test("transfer IMBU to Mangata", async () => {
  const tx = imbue.api!.tx.xTokens.transfer(
    //@ts-ignore
    { Native: 0 },
    Utils.amount(20, 10),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test("transfer MGAS to IMBU", async () => {
  const tx = mga.api!.tx.xTokens.transferMultiasset(
    {
      V1: {
        id: {
          Concrete: {
            parents: 1,
            interior: {
              X2: [{ Parachain: 2110 }, { GeneralKey: "0x00000000" }],
            },
          },
        },
        fun: {
          Fungible: Utils.amount(10, 18),
        },
      },
    },
    Utils.location(2121, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test("transfer back IMBU to IMBU", async () => {
  const tx = mga.api!.tx.xTokens.transferMultiasset(
    {
      V1: {
        id: {
          Concrete: {
            parents: 1,
            interior: {
              X2: [
                {
                  Parachain: 2121,
                },
                {
                  GeneralKey: "0x0096",
                },
              ],
            },
          },
        },
        fun: {
          Fungible: Utils.amount(10, 10),
        },
      },
    },
    Utils.location(2121, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test("transfer MGAS from IMBU -MA", async () => {
  const tx = imbue.api!.tx.xTokens.transferMultiasset(
    {
      V1: {
        id: {
          Concrete: {
            parents: 1,
            interior: {
              X2: [{ Parachain: 2110 }, { GeneralKey: "0x00000000" }],
            },
          },
        },
        fun: {
          Fungible: Utils.amount(5, 18),
        },
      },
    },
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});
