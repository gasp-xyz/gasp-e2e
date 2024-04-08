/*
 * @group cookiesAndMilk
 *
 */
import { jest } from "@jest/globals";
import { ApiPromise, Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { BN, BN_ZERO } from "@polkadot/util";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { signTx } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let api: ApiPromise;
let sudo: User;
let keyring: Keyring;
const nativeCurrencyId = MGA_ASSET_ID;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "ethereum" });

  api = getApi();
  sudo = new User(
    keyring,
    "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133",
  );

  await setupApi();

  [testUser1] = setupUsers();

  keyring.addPair(sudo.keyRingPair);

  testUser1.addAsset(nativeCurrencyId);
  // await Sudo.batchAsSudoFinalized(
  //   Assets.mintNative(testUser1),
  //   Assets.mintNative(testUser2),
  //   Assets.mintNative(testUser3),
  //   Assets.mintNative(testUser4),
  // );
});

test.only("fooo", async () => {
  // eslint-disable-next-line no-console
  console.log(sudo.keyRingPair.address);
  const as = await signTx(
    getApi(),
    api.tx.tokens.transfer(sudo.keyRingPair.address, BN_ZERO, new BN(100)),
    sudo.keyRingPair,
  );
  // eslint-disable-next-line no-console
  console.log(as);
});
