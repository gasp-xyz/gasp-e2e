import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { Utils } from "./Utils";
import { Keyring } from "@polkadot/api";
import { Node } from "../../utils/cluster/Node";
import { BN } from "@mangata-finance/sdk";

let { acalaUri } = getEnvironmentRequiredVars();
const KAR_WEIGHT = 4 * 200_000_000;
const MG_WEIGHT = 4 * 1_000_000_000;
const karAssetID = new BN(6);
let mga: Node;
let testUser: User;
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
  testUser = new User(keyring, "foo");
  //  testUser.addFromMnemonic(
  //    keyring,
  //    "dismiss addict reduce fitness install aisle creek they seek palace stereo trumpet"
  //  );
});

test("transfer KAR to Mangata", async () => {
  testUser.addAsset(karAssetID);
  const tokensAmount = Utils.amount(10, 12);
  await testUser.refreshAmounts(AssetWallet.BEFORE);

  let tx = acala.api!.tx.xTokens.transfer(
    { Token: "KAR" },
    tokensAmount,
    Utils.location(2110, testUser.keyRingPair.publicKey),
    MG_WEIGHT
  );
  await Utils.signAndSend(alice, tx);
  await waitForNBlocks(3);

  await testUser.refreshAmounts(AssetWallet.AFTER);
  expect(testUser.getFreeAssetAmount(karAssetID).amountBefore).bnEqual(
    new BN(0)
  );
  expect(testUser.getFreeAssetAmount(karAssetID).amountAfter).bnGt(
    tokensAmount.divn(10)
  );
  tx = mga.api!.tx.xTokens.transferMultiasset(
    Utils.asset(2000, "0x0080", Utils.amount(1, 12)),
    Utils.location(2000, alice.keyRingPair.publicKey),
    KAR_WEIGHT
  );
  await Utils.signAndSend(testUser, tx);
});
