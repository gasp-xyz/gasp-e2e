/*
 *
 * @group xyk
 * @group accuracy
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import { AssetWallet, User } from "../../utils/User";
import {
  KSM_ASSET_ID,
  MGA_ASSET_ID,
  TUR_ASSET_ID,
} from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { setupApi, alice as Alice, setupUsers } from "../../utils/setup";
import { BN_TEN, BN_THOUSAND, signTx } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let testUserMGX: User;
let testUserKSM: User;
let testUserTUR: User;
let alice: User;
let keyring: Keyring;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  setupUsers();
  keyring = new Keyring({ type: "sr25519" });
  testUserMGX = new User(keyring);
  testUserKSM = new User(keyring);
  testUserTUR = new User(keyring);
  alice = Alice;
  // add users to pair.
  keyring.addPair(testUserMGX.keyRingPair);
  keyring.addPair(testUserKSM.keyRingPair);
  keyring.addPair(testUserTUR.keyRingPair);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(MGA_ASSET_ID, testUserMGX),
    Assets.mintToken(KSM_ASSET_ID, testUserKSM),
    Assets.mintToken(TUR_ASSET_ID, testUserTUR),
  );
});
test("Fees : Transfers are about 5~ MGX", async () => {
  const api = getApi();
  testUserMGX.addAsset(MGA_ASSET_ID);
  await testUserMGX.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    api,
    Assets.transfer(alice, MGA_ASSET_ID, BN_THOUSAND),
    testUserMGX.keyRingPair,
  );
  await testUserMGX.refreshAmounts(AssetWallet.AFTER);
  const diff = testUserMGX.getWalletDifferences();

  //Assert:We pay like 5MGAs per tokens transfer.
  const upperValue = new BN(6).mul(Assets.MG_UNIT);
  const lowerValue = new BN(5).mul(Assets.MG_UNIT);
  expect(diff[0].diff.free.muln(-1)).bnLt(upperValue);
  expect(diff[0].diff.free.muln(-1)).bnGt(lowerValue);
});
test("Fees : Transfers are about 0.005~ KSM", async () => {
  const api = getApi();
  testUserKSM.addAsset(KSM_ASSET_ID);
  await testUserKSM.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    api,
    Assets.transfer(alice, KSM_ASSET_ID, BN_THOUSAND),
    testUserKSM.keyRingPair,
  );
  await testUserKSM.refreshAmounts(AssetWallet.AFTER);
  const diff = testUserKSM.getWalletDifferences();

  //Assert:We pay like 0.005Ksms per tokens transfer.
  const upperValue = new BN(6).mul(Assets.KSM_UNIT).div(BN_THOUSAND);
  const lowerValue = new BN(5).mul(Assets.KSM_UNIT).div(BN_THOUSAND);
  expect(diff[0].diff.free.muln(-1)).bnLt(upperValue);
  expect(diff[0].diff.free.muln(-1)).bnGt(lowerValue);
});
test("Fees : Transfers are about 0.5~ TUR", async () => {
  const api = getApi();
  testUserTUR.addAsset(TUR_ASSET_ID);
  await testUserTUR.refreshAmounts(AssetWallet.BEFORE);
  await signTx(
    api,
    Assets.transfer(alice, TUR_ASSET_ID, BN_THOUSAND),
    testUserTUR.keyRingPair,
  );
  await testUserTUR.refreshAmounts(AssetWallet.AFTER);
  const diff = testUserTUR.getWalletDifferences();

  //Assert:We pay like 0.005TURs per tokens transfer.
  const upperValue = new BN(6).mul(Assets.TUR_UNIT).div(BN_TEN);
  const lowerValue = new BN(5).mul(Assets.TUR_UNIT).div(BN_TEN);
  expect(diff[0].diff.free.muln(-1)).bnLt(upperValue);
  expect(diff[0].diff.free.muln(-1)).bnGt(lowerValue);
});
