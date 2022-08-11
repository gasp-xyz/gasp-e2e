import { api, initApi } from "../../utils/api";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { signTx } from "@mangata-finance/sdk";
import { Utils } from "./Utils";
import { beforeAll, test } from "vitest";
import { Keyring } from "@polkadot/api";

const { acalaUri } = getEnvironmentRequiredVars();
const KAR_WEIGHT = 4 * 200_000_000;
const MG_WEIGHT = 4 * 1_000_000_000;

let alice: User;
let bob: User;
let acala: AcalaNode;

beforeAll(async () => {
  await initApi();
  acala = new AcalaNode(acalaUri);
  await acala.connect();

  const keyring = new Keyring({ type: "sr25519" });
  alice = new User(keyring, "//Alice");
  bob = new User(keyring, "//Charlie");
});

test.only("- TR -transfer - transfer KAR to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transfer(
    { Token: "KSM" },
    Utils.amount(10, 12),
    Utils.location(2110, bob.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test.only("- TR -MultiAsset- transfer KAR to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2000, "0x0080", Utils.amount(10, 12)),
    Utils.location(2110, bob.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test("transfer - transfer back KAR to Acala", async () => {
  const tx = api!.tx.xTokens.transferMultiasset(
    Utils.asset(2000, "0x0080", Utils.amount(5, 3)),
    Utils.location(2000, bob.keyRingPair.publicKey),
    KAR_WEIGHT
  );
  await signTx(api!, tx, bob.keyRingPair);
});

test("transfer - transfer MGR to Acala", async () => {
  const tx = api!.tx.xTokens.transfer(
    0,
    Utils.amount(6, 8),
    Utils.location(2000, alice.keyRingPair.publicKey),
    KAR_WEIGHT
  );
  await signTx(api!, tx, alice.keyRingPair);
});

test("transfer - transfer MGR back to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transfer(
    // @ts-ignore
    { ForeignAsset: 0 },
    Utils.amount(50, 18),
    Utils.location(2110, alice.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});

test.skip("transfer - transfer multiasset MGR to Acala", async () => {
  const tx = api!.tx.xTokens.transferMultiasset(
    Utils.asset(2110, "0x00000000", Utils.amount(100, 18)),
    Utils.location(2000, alice.keyRingPair.publicKey),
    KAR_WEIGHT
  );
  await signTx(api!, tx, alice.keyRingPair);
});

test("transfer - transfer multiasset MGR back to Mangata", async () => {
  const tx = acala.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2110, "0x00000000", Utils.amount(10, 18)),
    Utils.location(2110, alice.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
});
