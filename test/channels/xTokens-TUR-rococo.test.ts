import { User } from "../../utils/User";
import { Utils } from "./Utils";
import { beforeAll, test } from "vitest";
import { Keyring } from "@polkadot/api";
import { Node } from "../../utils/cluster/Node";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";

const TUR_WEIGHT = 4 * 200_000_000;
const MG_WEIGHT = 4 * 1_000_000_000;
let mga: Node;
let testUser: any;
let alice: User;
let tur: AcalaNode;

beforeAll(async () => {
  //await initApi();
  const OakUri = "wss://rpc.turing-staging.oak.tech";
  tur = new AcalaNode(OakUri);
  mga = new Node(
    "mga",
    "wss://roccoco-testnet-collator-01.mangatafinance.cloud"
  );
  await tur.connect();
  await mga.connect();

  const keyring = new Keyring({ type: "sr25519" });
  testUser = new User(keyring, "foo");
  testUser.addFromMnemonic(keyring, "<manemonic>");
});

test("OAK transfer TUR to Mangata", async () => {
  const tx = tur.api!.tx.xTokens.transfer(
    { Native: 0 },
    Utils.amount(20, 10),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test("transfer TUR to Mangata-MA", async () => {
  const tx = tur.api!.tx.xTokens.transferMultiasset(
    {
      V1: {
        id: {
          Concrete: {
            parents: 1,
            interior: {
              X1: {
                Parachain: 2114,
              },
            },
          },
        },
        fun: {
          Fungible: Utils.amount(10, 10),
        },
      },
    },
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test("transfer back TUR to Oak-MA", async () => {
  const tx = mga.api!.tx.xTokens.transferMultiasset(
    {
      V1: {
        id: {
          Concrete: {
            parents: 1,
            interior: {
              X1: {
                Parachain: 2114,
              },
            },
          },
        },
        fun: {
          Fungible: Utils.amount(10, 10),
        },
      },
    },
    Utils.location(2114, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test.skip("Not supported - transfer MGAS to Oak", async () => {
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
          Fungible: Utils.amount(10000, 18),
        },
      },
    },
    Utils.location(2114, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test.skip("Not supported - FIXME:transfer MGR from Oak to Mangata", async () => {
  const tx = tur.api!.tx.xTokens.transfer(
    // @ts-ignore
    { ForeignAsset: 13 },
    Utils.amount(5, 18),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test.skip("Not supported - FIXME: transfer multiasset MGR to Oak", async () => {
  const tx = mga.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2110, "0x00000000", Utils.amount(10, 18)),
    Utils.location(2000, alice.keyRingPair.publicKey),
    TUR_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});
test.skip("Not supported - FIXME: transfer - transfer multiasset MGR back to Mangata", async () => {
  const tx = tur.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2110, "0x00000000", Utils.amount(5, 18)),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});
