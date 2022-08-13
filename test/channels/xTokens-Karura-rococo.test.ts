import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { Utils } from "./Utils";
import { beforeAll, test } from "vitest";
import { Keyring } from "@polkadot/api";
import { Node } from "../../utils/cluster/Node";

let { acalaUri } = getEnvironmentRequiredVars();
const KAR_WEIGHT = 4 * 200_000_000;
const MG_WEIGHT = 4 * 1_000_000_000;
let mga: Node;
let testUser: any;
let alice: User;
let acala: AcalaNode;

beforeAll(async () => {
  //await initApi();
  acalaUri = "wss://karura-rococo.aca-dev.network";
  acala = new AcalaNode(acalaUri);
  mga = new Node(
    "mga",
    "wss://roccoco-testnet-collator-01.mangatafinance.cloud"
  );
  await acala.connect();
  await mga.connect();

  const keyring = new Keyring({ type: "sr25519" });
  alice = new User(keyring, "//Alice");
  testUser = new User(keyring, "foo");
  testUser.addFromMnemonic(keyring, "<mnemonic>");
});

test("transfer KAR to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transfer(
    { Token: "KSM" },
    Utils.amount(10, 12),
    Utils.location(2110, testUser.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test("transfer KAR to Mangata-MA", async () => {
  const tx = acala.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2000, "0x0080", Utils.amount(10, 12)),
    Utils.location(2110, testUser.publicKey),
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
