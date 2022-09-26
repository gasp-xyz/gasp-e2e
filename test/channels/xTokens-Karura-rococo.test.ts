import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { Utils } from "./Utils";
import { Keyring } from "@polkadot/api";
import { Node } from "../../utils/cluster/Node";
import { BN } from "@mangata-finance/sdk";

let { acalaUri } = getEnvironmentRequiredVars();
const KAR_WEIGHT = 4 * 200_000_000;
const MG_WEIGHT = 4 * 1_000_000_000;
let mga: Node;
let testUser: any;
let keyring: Keyring;
let alice: User;
let acala: AcalaNode;
jest.setTimeout(1500000);
beforeAll(async () => {
  //await initApi();
  acalaUri = "ws://127.0.0.1:9946";
  acala = new AcalaNode(acalaUri);
  mga = new Node("mga", "ws://127.0.0.1:9948");
  await acala.connect();
  await mga.connect();

  keyring = new Keyring({ type: "sr25519" });
  alice = new User(keyring, "//Alice");
  testUser = new User(keyring, "//Bob");
  //  testUser.addFromMnemonic(
  //    keyring,
  //    "dismiss addict reduce fitness install aisle creek they seek palace stereo trumpet"
  //  );
});

test("1transfer KAR to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transfer(
    { Token: "KAR" },
    Utils.amount(10, 12),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test("1transfer LKSM to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transfer(
    { Token: "LKSM" },
    Utils.amount(10, 30),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test("transfer KAR to Mangata-MA", async () => {
  const tx = acala.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2000, "0x0080", Utils.amount(10, 15)),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test("transfer back KAR to Acala-MA", async () => {
  const tx = mga.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2000, "0x0080", Utils.amount(1, 12)),
    Utils.location(2000, alice.keyRingPair.publicKey),
    KAR_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test("transfer MGAS to Acala", async () => {
  const tx = mga.api!.tx.xTokens.transfer(
    0,
    Utils.amount(6, 18),
    Utils.location(2000, alice.keyRingPair.publicKey),
    KAR_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});

test("transfer MGR from acala to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transfer(
    // @ts-ignore
    { ForeignAsset: 13 },
    Utils.amount(5, 18),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test("transfer multiasset MGR to Acala", async () => {
  const tx = mga.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2110, "0x00000000", Utils.amount(10, 18)),
    Utils.location(2000, alice.keyRingPair.publicKey),
    KAR_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});
test("transfer - transfer multiasset MGR back to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2110, "0x00000000", Utils.amount(5, 18)),
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});
test("configure asset registry", async () => {
  const tx = mga.api!.tx.assetRegistry.updateAsset(
    6,
    12,
    "Karura",
    "KAR",
    0,
    {
      V1: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2000,
            },
            {
              GeneralKey: "0x0080",
            },
          ],
        },
      },
    },
    {
      xcm: {
        feePerSecond: 53760000000001,
      },
    }
  );

  await Utils.signAndSend(alice, mga.api!.tx.sudo.sudo(tx));
});
test("remove fee/s", async () => {
  const tx = mga.api!.tx.assetRegistry.updateAsset(
    16,
    12,
    "Karura",
    "KAR",
    0,
    {
      V1: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: 2000,
            },
            {
              GeneralKey: "0x0083",
            },
          ],
        },
      },
    },
    null
  );

  await Utils.signAndSend(alice, mga.api!.tx.sudo.sudo(tx));
});
test("update - LKSM add 1 fee", async () => {
  const tx = mga.api!.tx.assetRegistry.updateAsset(
    16,
    12,
    "KAR - 0x0083",
    "LKSM",
    0,
    {
      V1: {
        parents: 1,
        interior: {
          X2: [
            {
              GeneralKey: "0x0080",
            },
            {
              Parachain: 2000,
            },
          ],
        },
      },
    },
    {
      xcm: {
        feePerSecond: "1000000000000000000000",
      },
    }
  );

  await Utils.signAndSend(alice, mga.api!.tx.sudo.sudo(tx));
});
test("update - KAR", async () => {
  const tx = mga.api!.tx.assetRegistry.updateAsset(
    6,
    10,
    "KAR - 10 dec",
    "KAR101",
    0,
    {
      V1: {
        parents: 1,
        interior: {
          X2: [
            {
              Parachain: "2000",
            },
            {
              GeneralKey: "0x0080",
            },
          ],
        },
      },
    },
    {
      xcm: {
        feePerSecond: 53760000000000,
      },
    }
  );

  await Utils.signAndSend(alice, mga.api!.tx.sudo.sudo(tx));
});

test("send cuatrillion txs", async () => {
  let currNonce = new BN(
    (
      (await acala.api?.query.system.account(alice.keyRingPair.address)) as any
    ).nonce
  );
  acala = new AcalaNode("ws://127.0.0.1:9946");
  await acala.connect();
  const promises = [];
  for (let i = 0; i < 1000; i++) {
    const tx = acala.api!.tx.xTokens.transfer(
      { Token: "KAR" },
      Utils.amount(10, 12),
      Utils.location(2110, testUser.keyRingPair.publicKey),
      MG_WEIGHT
    );
    const signed = tx.sign(alice.keyRingPair, { nonce: currNonce });
    const p = signed.send();
    promises.push(p);
    currNonce = currNonce.addn(1);
    //await Utils.signAndSend(alice, tx);
  }
  await Promise.all(promises);
});
